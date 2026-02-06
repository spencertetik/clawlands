-- Claw World Database Schema
-- Run this in Supabase SQL Editor after creating project

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- PLAYERS TABLE
-- Persistent player data (accounts)
-- ============================================
create table players (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    species text not null default 'lobster',
    color text not null default 'red',
    
    -- Position (saved on disconnect)
    last_x integer default 744,
    last_y integer default 680,
    last_island text default 'Port Clawson',
    
    -- Stats
    continuity real default 50.0,
    created_at timestamptz default now(),
    last_seen timestamptz default now(),
    
    -- Constraints
    constraint valid_species check (species in ('lobster', 'crab', 'shrimp', 'hermit', 'crawfish')),
    constraint name_length check (char_length(name) between 1 and 20)
);

-- Index for fast lookups
create index players_user_id_idx on players(user_id);
create unique index players_name_idx on players(lower(name));

-- ============================================
-- PLAYER_PRESENCE TABLE  
-- Real-time player positions (ephemeral)
-- ============================================
create table player_presence (
    id uuid primary key references players(id) on delete cascade,
    x integer not null,
    y integer not null,
    facing text default 'down',
    is_moving boolean default false,
    current_island text,
    is_indoors boolean default false,
    updated_at timestamptz default now()
);

-- Index for spatial queries
create index presence_position_idx on player_presence(x, y);

-- ============================================
-- CHAT_MESSAGES TABLE
-- Persistent chat history
-- ============================================
create table chat_messages (
    id uuid primary key default uuid_generate_v4(),
    player_id uuid references players(id) on delete set null,
    player_name text not null,
    message text not null,
    
    -- Location context
    x integer,
    y integer,
    island text,
    
    -- Metadata
    is_bot boolean default false,
    created_at timestamptz default now(),
    
    constraint message_length check (char_length(message) between 1 and 500)
);

-- Index for recent messages
create index chat_created_idx on chat_messages(created_at desc);

-- ============================================
-- FACTION_REPUTATION TABLE
-- Player faction standings
-- ============================================
create table faction_reputation (
    player_id uuid references players(id) on delete cascade,
    faction text not null,
    reputation integer default 0,
    primary key (player_id, faction),
    
    constraint valid_faction check (faction in (
        'anchors', 'drifters', 'threadkeepers', 'church_of_molt', 'iron_reef'
    )),
    constraint rep_bounds check (reputation between -1000 and 1000)
);

-- ============================================
-- BOT_SESSIONS TABLE
-- Track AI agent connections
-- ============================================
create table bot_sessions (
    id uuid primary key default uuid_generate_v4(),
    player_id uuid references players(id) on delete cascade,
    bot_name text not null,
    api_key_hash text not null,
    
    -- Rate limiting
    requests_today integer default 0,
    last_request timestamptz,
    
    -- Metadata
    created_at timestamptz default now(),
    last_active timestamptz default now(),
    is_active boolean default true
);

create index bot_sessions_key_idx on bot_sessions(api_key_hash);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
alter table players enable row level security;
alter table player_presence enable row level security;
alter table chat_messages enable row level security;
alter table faction_reputation enable row level security;
alter table bot_sessions enable row level security;

-- Players: users can read all, write only their own
create policy "Players are viewable by everyone" 
    on players for select using (true);

create policy "Users can insert their own player" 
    on players for insert with check (auth.uid() = user_id);

create policy "Users can update their own player" 
    on players for update using (auth.uid() = user_id);

-- Presence: everyone can read, users update their own
create policy "Presence is viewable by everyone" 
    on player_presence for select using (true);

create policy "Users can update their own presence" 
    on player_presence for insert with check (
        id in (select id from players where user_id = auth.uid())
    );

create policy "Users can modify their own presence" 
    on player_presence for update using (
        id in (select id from players where user_id = auth.uid())
    );

create policy "Users can delete their own presence" 
    on player_presence for delete using (
        id in (select id from players where user_id = auth.uid())
    );

-- Chat: everyone can read, users can insert
create policy "Chat is viewable by everyone" 
    on chat_messages for select using (true);

create policy "Authenticated users can chat" 
    on chat_messages for insert with check (auth.uid() is not null);

-- Faction rep: users can read all, modify their own
create policy "Reputation is viewable by everyone" 
    on faction_reputation for select using (true);

create policy "Users can modify their own reputation" 
    on faction_reputation for all using (
        player_id in (select id from players where user_id = auth.uid())
    );

-- Bot sessions: only service role can access
create policy "Bot sessions are private" 
    on bot_sessions for all using (false);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger presence_updated_at
    before update on player_presence
    for each row execute function update_updated_at();

-- Clean up stale presence (players who haven't updated in 30 seconds)
create or replace function cleanup_stale_presence()
returns void as $$
begin
    delete from player_presence 
    where updated_at < now() - interval '30 seconds';
end;
$$ language plpgsql;

-- ============================================
-- REALTIME SETUP
-- Enable realtime for presence and chat
-- ============================================

-- This is done in Supabase dashboard:
-- Database > Replication > Enable for: player_presence, chat_messages
