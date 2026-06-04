-- Seed Initial Users (Passwords: "Password123!" hashed with bcrypt)
INSERT INTO users (id, email, username, display_name, password_hash, avatar_url, presence_status) VALUES
('usr_admin01', 'admin@slackclone.com', 'admin_user', 'System Administrator', '$2b$10$WdZ5f4aR6tQ7R7Q8Z.QWue.w184wM/r0s02.n9c4fN9E6hN4kKz6m', 'https://api.dicebear.com/7.x/bottts/svg?seed=admin', 'online')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, username, display_name, password_hash, avatar_url, presence_status) VALUES
('usr_alice02', 'alice@company.com', 'alice_dev', 'Alice Chen', '$2b$10$WdZ5f4aR6tQ7R7Q8Z.QWue.w184wM/r0s02.n9c4fN9E6hN4kKz6m', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice', 'online')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, username, display_name, password_hash, avatar_url, presence_status) VALUES
('usr_bob0003', 'bob@company.com', 'bob_designer', 'Bob Smith', '$2b$10$WdZ5f4aR6tQ7R7Q8Z.QWue.w184wM/r0s02.n9c4fN9E6hN4kKz6m', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob', 'offline')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, username, display_name, password_hash, avatar_url, presence_status) VALUES
('usr_charlie', 'charlie@company.com', 'charlie_pm', 'Charlie Brown', '$2b$10$WdZ5f4aR6tQ7R7Q8Z.QWue.w184wM/r0s02.n9c4fN9E6hN4kKz6m', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie', 'away')
ON CONFLICT (id) DO NOTHING;

-- Seed Workspaces
INSERT INTO workspaces (id, name, slug, owner_id) VALUES
('wsp_devhq0', 'Developer HQ', 'developer-hq', 'usr_admin01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug, owner_id) VALUES
('wsp_design', 'Design Studio', 'design-studio', 'usr_bob0003')
ON CONFLICT (id) DO NOTHING;

-- Link Users to Workspaces
INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
('wsp_devhq0', 'usr_admin01', 'admin'),
('wsp_devhq0', 'usr_alice02', 'member'),
('wsp_devhq0', 'usr_bob0003', 'member'),
('wsp_design', 'usr_bob0003', 'admin'),
('wsp_design', 'usr_alice02', 'member')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Seed Channels
INSERT INTO channels (id, workspace_id, name, is_private, creator_id) VALUES
('chn_general1', 'wsp_devhq0', 'general', false, 'usr_admin01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO channels (id, workspace_id, name, is_private, creator_id) VALUES
('chn_random02', 'wsp_devhq0', 'random', false, 'usr_admin01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO channels (id, workspace_id, name, is_private, creator_id) VALUES
('chn_devops03', 'wsp_devhq0', 'devops-alerts', true, 'usr_alice02')
ON CONFLICT (id) DO NOTHING;

INSERT INTO channels (id, workspace_id, name, is_private, creator_id) VALUES
('chn_branding', 'wsp_design', 'branding', false, 'usr_bob0003')
ON CONFLICT (id) DO NOTHING;

-- Channel Membership
INSERT INTO channel_members (channel_id, user_id) VALUES
('chn_general1', 'usr_admin01'),
('chn_general1', 'usr_alice02'),
('chn_general1', 'usr_bob0003'),
('chn_random02', 'usr_admin01'),
('chn_random02', 'usr_alice02'),
('chn_devops03', 'usr_alice02'),
('chn_devops03', 'usr_admin01'),
('chn_branding', 'usr_bob0003'),
('chn_branding', 'usr_alice02')
ON CONFLICT (channel_id, user_id) DO NOTHING;

-- Seed Messages
INSERT INTO messages (id, channel_id, user_id, content) VALUES
('msg_001', 'chn_general1', 'usr_admin01', 'Welcome everyone to the Developer HQ workspace! Let''s build something great.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (id, channel_id, user_id, content) VALUES
('msg_002', 'chn_general1', 'usr_alice02', 'Hi Admin! Happy to be here. Setup looks awesome.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (id, channel_id, user_id, content) VALUES
('msg_003', 'chn_general1', 'usr_bob0003', 'Hello, test message! I will upload some design briefs in a bit.')
ON CONFLICT (id) DO NOTHING;

-- Seed Threads (Replies)
INSERT INTO messages (id, channel_id, user_id, content, thread_id, parent_id) VALUES
('msg_004', 'chn_general1', 'usr_admin01', 'Glad you like it, Alice! Let me know if you need anything.', 'msg_002', 'msg_002')
ON CONFLICT (id) DO NOTHING;

-- Seed Reactions
INSERT INTO reactions (id, message_id, user_id, emoji) VALUES
('re_001', 'msg_001', 'usr_alice02', '👍'),
('re_002', 'msg_001', 'usr_bob0003', '🙌'),
('re_003', 'msg_002', 'usr_admin01', '🚀')
ON CONFLICT (message_id, user_id, emoji) DO NOTHING;

-- Seed Direct Messages Channels (Chats)
INSERT INTO direct_messages (id, workspace_id, member_one_id, member_two_id) VALUES
('dm_admin_alice', 'wsp_devhq0', 'usr_admin01', 'usr_alice02'),
('dm_alice_bob', 'wsp_devhq0', 'usr_alice02', 'usr_bob0003')
ON CONFLICT (workspace_id, member_one_id, member_two_id) DO NOTHING;

-- Seed DM Messages
INSERT INTO dm_messages (id, dm_id, sender_id, content) VALUES
('dmm_001', 'dm_admin_alice', 'usr_admin01', 'Hey Alice, did you check the deployment script?'),
('dmm_002', 'dm_admin_alice', 'usr_alice02', 'Yes, looking into the Dockerfile right now.'),
('dmm_003', 'dm_alice_bob', 'usr_bob0003', 'Hey Alice, do you have a minute to review the wireframes?')
ON CONFLICT (id) DO NOTHING;
