import os
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Numeric, Boolean, Text
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

def utcnow(): return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    email = Column(String(254), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    business_name = Column(String(140), nullable=False)
    report_currency = Column(String(3), default='EUR', nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

class Session(Base):
    __tablename__ = 'sessions'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False)
    csrf_hash = Column(String(64), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

class OAuthState(Base):
    __tablename__ = 'oauth_states'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    provider = Column(String(20), nullable=False)
    state_hash = Column(String(64), unique=True, nullable=False)
    meta_encrypted = Column(Text, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

class Connection(Base):
    __tablename__ = 'connections'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    provider = Column(String(20), nullable=False)
    external_id = Column(String(180), nullable=False)
    display_name = Column(String(180), nullable=False)
    token_encrypted = Column(Text, nullable=False)
    refresh_encrypted = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    last_sync = Column(DateTime(timezone=True), nullable=True)
    sync_error = Column(Text, nullable=True)
    __table_args__ = (UniqueConstraint('user_id','provider','external_id'),)

class ProductCost(Base):
    __tablename__ = 'product_costs'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    sku = Column(String(150), nullable=False)
    product = Column(String(300), default='')
    amount = Column(Numeric(18,6), nullable=True)
    currency = Column(String(3), nullable=False)
    status = Column(String(20), nullable=False, default='available') # available/missing/ambiguous
    source = Column(String(24), default='shopify')
    updated_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    __table_args__ = (UniqueConstraint('user_id','sku'),)

class FxRate(Base):
    __tablename__ = 'fx_rates'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    currency = Column(String(3), nullable=False)
    rate = Column(Numeric(24,12), nullable=False)
    __table_args__ = (UniqueConstraint('user_id','currency'),)

class OrderLine(Base):
    __tablename__ = 'order_lines'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    provider = Column(String(20), nullable=False)
    external_account = Column(String(180), nullable=False, default='import')
    order_id = Column(String(180), nullable=False)
    line_id = Column(String(180), nullable=False)
    ordered_at = Column(DateTime(timezone=True), nullable=False, index=True)
    sku = Column(String(150), nullable=False, default='')
    product = Column(String(300), nullable=False, default='')
    quantity = Column(Numeric(14,4), nullable=False)
    currency = Column(String(3), nullable=False)
    item_revenue = Column(Numeric(18,4), nullable=False)
    shipping_revenue = Column(Numeric(18,4), nullable=False, default=0)
    item_refunds = Column(Numeric(18,4), nullable=False, default=0)
    shipping_refunds = Column(Numeric(18,4), nullable=False, default=0)
    fees = Column(Numeric(18,4), nullable=True)  # NULL = unknown, 0 = explicitly zero
    shipping_cost = Column(Numeric(18,4), nullable=True)
    other_cost = Column(Numeric(18,4), nullable=False, default=0)
    cogs_snapshot = Column(Numeric(18,6), nullable=True)
    cogs_currency = Column(String(3), nullable=True)
    cogs_source = Column(String(60), nullable=True)
    status = Column(String(50), default='paid')
    __table_args__ = (UniqueConstraint('user_id','provider','external_account','order_id','line_id'),)

def make_engine():
    url=os.getenv('DATABASE_URL','sqlite:///./channelpilot.db')
    # Render's managed Postgres connectionString is postgresql://; select installed psycopg 3.
    if url.startswith('postgresql://'):
        url='postgresql+psycopg://'+url[len('postgresql://'):]
    elif url.startswith('postgres://'):
        url='postgresql+psycopg://'+url[len('postgres://'):]
    return create_engine(url, connect_args={'check_same_thread':False} if url.startswith('sqlite:') else {}, pool_pre_ping=True)

engine=make_engine()
SessionLocal=sessionmaker(bind=engine, expire_on_commit=False)
