const fs = require('fs');
const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const LOG_PATH = path.join(__dirname, 'mcp-playtest-log.json');

function now() {
  return new Date().toISOString();
}

function extractText(result) {
  if (!result || !Array.isArray(result.content)) return '';
  return result.content.map((c) => c.text || '').join('\n').trim();
}

async function run() {
  const client = new Client({ name: 'clawlands-audit', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['server/mcpServer.js'],
    env: {
      CLAWLANDS_BOT_KEY: process.env.CLAWLANDS_BOT_KEY || '',
      CLAWLANDS_SERVER: process.env.CLAWLANDS_SERVER || ''
    }
  });

  const log = {
    startedAt: now(),
    steps: []
  };

  const call = async (name, args = {}) => {
    const entry = { at: now(), tool: name, args };
    try {
      const result = await client.callTool({ name, arguments: args });
      entry.result = result;
      entry.text = extractText(result);
    } catch (err) {
      entry.error = String(err);
    }
    log.steps.push(entry);
    return entry;
  };

  try {
    await client.connect(transport);

    await call('register', { name: 'OpenClawAudit', species: 'lobster', color: 'red' });
    await call('status');
    await call('look');
    await call('players');
    await call('chat', { message: 'OpenClawAudit doing a quick QA walkaround — feel free to ignore.' });

    const targets = [
      { x: 200, y: 200 },
      { x: 960, y: 960 },
      { x: 1600, y: 300 },
      { x: 300, y: 1600 }
    ];

    for (const target of targets) {
      await call('move', target);
      await call('look');
    }

    const directions = ['north', 'east', 'south', 'west'];
    for (const dir of directions) {
      await call('move', { direction: dir, steps: 5 });
      await call('look');
    }

    await call('players');
    await call('disconnect');
  } finally {
    await client.close().catch(() => {});
    log.finishedAt = now();
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
  }
}

run().catch((err) => {
  const payload = { startedAt: now(), error: String(err) };
  fs.writeFileSync(LOG_PATH, JSON.stringify(payload, null, 2));
  process.exit(1);
});
