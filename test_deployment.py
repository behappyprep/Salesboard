import base64
import secrets
from cryptography.fernet import Fernet
from main import public_url
from providers import callback_url
import models


def test_render_generated_fernet_secret():
    # Render generateValue produces 32 random bytes encoded as standard base64.
    candidate = base64.b64encode(secrets.token_bytes(32))
    cipher = Fernet(candidate)
    assert cipher.decrypt(cipher.encrypt(b'test')) == b'test'


def test_render_origin_and_oauth_callback(monkeypatch):
    monkeypatch.delenv('APP_URL', raising=False)
    monkeypatch.setenv('RENDER_EXTERNAL_URL', 'https://channelpilot-example.onrender.com')
    assert public_url() == 'https://channelpilot-example.onrender.com'
    assert callback_url('shopify') == 'https://channelpilot-example.onrender.com/api/oauth/shopify/callback'


def test_render_postgres_url_uses_installed_psycopg3(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/channelpilot')
    captured = {}
    def fake_create_engine(url, **kwargs):
        captured['url'] = url
        return object()
    monkeypatch.setattr(models, 'create_engine', fake_create_engine)
    models.make_engine()
    assert captured['url'].startswith('postgresql+psycopg://')
