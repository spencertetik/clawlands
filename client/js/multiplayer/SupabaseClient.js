/**
 * SupabaseClient.js - Claw World Supabase Integration
 * Handles auth, realtime presence, and chat
 * 
 * @version 1.0.0
 */

class ClawWorldSupabase {
    constructor(supabaseUrl, supabaseKey) {
        this.supabase = supabase.createClient(supabaseUrl, supabaseKey);
        this.player = null;
        this.playerId = null;
        this.presenceChannel = null;
        this.chatChannel = null;
        this.onPlayersUpdate = null;
        this.onChatMessage = null;
        this.onPlayerJoin = null;
        this.onPlayerLeave = null;
        this.updateInterval = null;
        this.lastPosition = { x: 0, y: 0 };
    }

    /**
     * Initialize anonymous auth session
     */
    async signInAnonymous() {
        const { data, error } = await this.supabase.auth.signInAnonymously();
        if (error) throw error;
        console.log('🔐 Signed in anonymously:', data.user.id);
        return data.user;
    }

    /**
     * Sign in with email (for persistent accounts)
     */
    async signInWithEmail(email, password) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data.user;
    }

    /**
     * Create or get player profile
     */
    async getOrCreatePlayer(name, species = 'lobster', color = 'red') {
        const user = (await this.supabase.auth.getUser()).data.user;
        if (!user) throw new Error('Not authenticated');

        // Check if player exists
        let { data: existing } = await this.supabase
            .from('players')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (existing) {
            this.player = existing;
            this.playerId = existing.id;
            
            // Update last_seen
            await this.supabase
                .from('players')
                .update({ last_seen: new Date().toISOString() })
                .eq('id', existing.id);
                
            console.log('👤 Loaded existing player:', existing.name);
            return existing;
        }

        // Create new player
        const { data: newPlayer, error } = await this.supabase
            .from('players')
            .insert({
                user_id: user.id,
                name: this.sanitizeName(name),
                species,
                color
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation
                throw new Error('Name already taken');
            }
            throw error;
        }

        this.player = newPlayer;
        this.playerId = newPlayer.id;
        
        // Initialize faction reputation
        const factions = ['anchors', 'drifters', 'threadkeepers', 'church_of_molt', 'iron_reef'];
        await this.supabase.from('faction_reputation').insert(
            factions.map(f => ({ player_id: newPlayer.id, faction: f, reputation: 0 }))
        );

        console.log('👤 Created new player:', newPlayer.name);
        return newPlayer;
    }

    /**
     * Sanitize player name
     */
    sanitizeName(name) {
        return name
            .replace(/<[^>]*>/g, '')      // Strip HTML
            .replace(/[^\w\s-]/g, '')     // Alphanumeric + space + dash
            .trim()
            .slice(0, 20) || 'Wanderer';
    }

    /**
     * Join the game world - subscribe to realtime channels
     */
    async joinWorld(x, y) {
        if (!this.playerId) throw new Error('No player loaded');

        // Insert/update presence
        await this.supabase
            .from('player_presence')
            .upsert({
                id: this.playerId,
                x,
                y,
                facing: 'down',
                is_moving: false,
                updated_at: new Date().toISOString()
            });

        // Subscribe to presence changes
        this.presenceChannel = this.supabase
            .channel('presence')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'player_presence'
            }, (payload) => this.handlePresenceChange(payload))
            .subscribe();

        // Subscribe to chat
        this.chatChannel = this.supabase
            .channel('chat')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages'
            }, (payload) => this.handleChatMessage(payload))
            .subscribe();

        // Start position update interval (throttled)
        this.startPresenceUpdates();

        console.log('🌍 Joined world at', x, y);
    }

    /**
     * Handle presence changes from other players
     */
    async handlePresenceChange(payload) {
        const { eventType, new: newData, old: oldData } = payload;

        // Skip our own updates
        if (newData?.id === this.playerId || oldData?.id === this.playerId) return;

        if (eventType === 'INSERT') {
            // New player joined - fetch their info
            const { data: player } = await this.supabase
                .from('players')
                .select('name, species, color')
                .eq('id', newData.id)
                .single();

            if (player && this.onPlayerJoin) {
                this.onPlayerJoin({
                    id: newData.id,
                    ...player,
                    x: newData.x,
                    y: newData.y,
                    facing: newData.facing
                });
            }
        } else if (eventType === 'DELETE') {
            if (this.onPlayerLeave) {
                this.onPlayerLeave(oldData.id);
            }
        } else if (eventType === 'UPDATE') {
            if (this.onPlayersUpdate) {
                this.onPlayersUpdate({
                    id: newData.id,
                    x: newData.x,
                    y: newData.y,
                    facing: newData.facing,
                    is_moving: newData.is_moving
                });
            }
        }
    }

    /**
     * Handle incoming chat messages
     */
    handleChatMessage(payload) {
        const msg = payload.new;
        
        // Skip our own messages
        if (msg.player_id === this.playerId) return;

        if (this.onChatMessage) {
            this.onChatMessage({
                id: msg.id,
                playerId: msg.player_id,
                name: msg.player_name,
                message: msg.message,
                x: msg.x,
                y: msg.y,
                isBot: msg.is_bot,
                timestamp: msg.created_at
            });
        }
    }

    /**
     * Update our position (throttled to every 100ms max)
     */
    startPresenceUpdates() {
        let pendingUpdate = null;
        
        this.updatePosition = (x, y, facing, isMoving) => {
            pendingUpdate = { x, y, facing, is_moving: isMoving };
        };

        this.updateInterval = setInterval(async () => {
            if (!pendingUpdate) return;
            
            // Skip if position hasn't changed significantly
            const dx = Math.abs(pendingUpdate.x - this.lastPosition.x);
            const dy = Math.abs(pendingUpdate.y - this.lastPosition.y);
            if (dx < 2 && dy < 2 && !pendingUpdate.is_moving) return;

            const update = { ...pendingUpdate, updated_at: new Date().toISOString() };
            pendingUpdate = null;
            this.lastPosition = { x: update.x, y: update.y };

            await this.supabase
                .from('player_presence')
                .update(update)
                .eq('id', this.playerId);
        }, 100);
    }

    /**
     * Send a chat message
     */
    async sendChat(message, x, y, island) {
        if (!this.playerId) return;

        const sanitized = message.trim().slice(0, 500);
        if (!sanitized) return;

        await this.supabase.from('chat_messages').insert({
            player_id: this.playerId,
            player_name: this.player.name,
            message: sanitized,
            x,
            y,
            island,
            is_bot: false
        });
    }

    /**
     * Get all current players in the world
     */
    async getActivePlayers() {
        const { data } = await this.supabase
            .from('player_presence')
            .select(`
                id,
                x,
                y,
                facing,
                is_moving,
                players (name, species, color)
            `)
            .neq('id', this.playerId);

        return (data || []).map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            facing: p.facing,
            isMoving: p.is_moving,
            name: p.players?.name,
            species: p.players?.species,
            color: p.players?.color
        }));
    }

    /**
     * Get recent chat messages
     */
    async getRecentChat(limit = 50) {
        const { data } = await this.supabase
            .from('chat_messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        return (data || []).reverse();
    }

    /**
     * Update faction reputation
     */
    async updateReputation(faction, delta) {
        if (!this.playerId) return;

        const { data: current } = await this.supabase
            .from('faction_reputation')
            .select('reputation')
            .eq('player_id', this.playerId)
            .eq('faction', faction)
            .single();

        const newRep = Math.max(-1000, Math.min(1000, (current?.reputation || 0) + delta));

        await this.supabase
            .from('faction_reputation')
            .update({ reputation: newRep })
            .eq('player_id', this.playerId)
            .eq('faction', faction);

        return newRep;
    }

    /**
     * Get all faction reputations
     */
    async getReputations() {
        if (!this.playerId) return {};

        const { data } = await this.supabase
            .from('faction_reputation')
            .select('faction, reputation')
            .eq('player_id', this.playerId);

        const reps = {};
        (data || []).forEach(r => reps[r.faction] = r.reputation);
        return reps;
    }

    /**
     * Leave the world - clean up presence
     */
    async leaveWorld() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        if (this.presenceChannel) {
            await this.supabase.removeChannel(this.presenceChannel);
        }

        if (this.chatChannel) {
            await this.supabase.removeChannel(this.chatChannel);
        }

        if (this.playerId) {
            // Save position to player record
            await this.supabase
                .from('players')
                .update({
                    last_x: this.lastPosition.x,
                    last_y: this.lastPosition.y,
                    last_seen: new Date().toISOString()
                })
                .eq('id', this.playerId);

            // Remove presence
            await this.supabase
                .from('player_presence')
                .delete()
                .eq('id', this.playerId);
        }

        console.log('👋 Left world');
    }

    /**
     * Sign out completely
     */
    async signOut() {
        await this.leaveWorld();
        await this.supabase.auth.signOut();
    }
}

// Export for use
window.ClawWorldSupabase = ClawWorldSupabase;
