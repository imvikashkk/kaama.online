-- Bot cloaking config in app_settings
INSERT INTO app_settings (key, value)
VALUES ('bot_cloaking', '{"enabled": false, "mode": "html", "redirect_url": "", "html_content": ""}')
ON CONFLICT (key) DO NOTHING;
