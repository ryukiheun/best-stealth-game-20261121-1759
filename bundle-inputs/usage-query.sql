-- Usage rows for best-stealth-game-20261121-1759 (muse.db, agent.agent_message_token_usage JOIN agent.agents).
-- Builder agent_id: 09cc6e17-667b-423c-8c6c-1b417c67516a
-- Fixer round 1 agent_id: 53327191-661c-4bd4-8b0a-2b8f415367d4
-- Fixer round 2 agent_id: b3d35826-3e33-4628-9a37-2a30d75c1fd5
-- Fixer round 3 agent_id: 374a4177-8cd2-4789-9961-1c144ab0a4f6
-- Fixer round 4 (blocker-fix) agent_id: e42d76f5-2fc0-4e9e-8205-b6ad37f8b030 (usage row not in muse.db yet at bundle time; re-run the query before submitting)
-- Parent session (7deb08f8-9a3a-4f50-b123-6a18bafb4d5c) is NOT bundled (excluded by design); its 28 usage rows are not attached.
-- Note: muse.db holds exactly 1 usage row per build subagent (4 rows total). Model recorded by the DB is ipnext/avocado-5.17-v2; bundle declares --model muse-spark-1.3 per playbook (same pattern as csv-reader-01, whose DB rows also recorded ipnext/avocado-5.17-v2).
SELECT u.agent_id AS agent_id, u.message_id AS message_id, u.created_at AS created_at, u.input_tokens AS input_tokens, u.output_tokens AS output_tokens, a.model AS model FROM agent.agent_message_token_usage u JOIN agent.agents a ON a.agent_id = u.agent_id WHERE u.agent_id IN ('09cc6e17-667b-423c-8c6c-1b417c67516a', '53327191-661c-4bd4-8b0a-2b8f415367d4', 'b3d35826-3e33-4628-9a37-2a30d75c1fd5', '374a4177-8cd2-4789-9961-1c144ab0a4f6', 'e42d76f5-2fc0-4e9e-8205-b6ad37f8b030') ORDER BY u.created_at DESC LIMIT 500
