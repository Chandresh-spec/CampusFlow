"""Refactor User model and add Profile table

Revision ID: 0001_user_profile_refactor
Revises: 
Create Date: 2026-10-27 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001_user_profile_refactor'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add verification and timestamp columns to users if missing
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_user_cols = [c['name'] for c in inspector.get_columns('users')]

    if 'email_verified_at' not in existing_user_cols:
        op.add_column('users', sa.Column('email_verified_at', sa.DateTime(), nullable=True))
    if 'updated_at' not in existing_user_cols:
        op.add_column('users', sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False))
    if 'deleted_at' not in existing_user_cols:
        op.add_column('users', sa.Column('deleted_at', sa.DateTime(), nullable=True))

    # Add unique constraint on users.email if not present
    existing_uniques = [u['name'] for u in inspector.get_unique_constraints('users')]
    if 'uq_users_email' not in existing_uniques and conn.dialect.name != 'sqlite':
        try:
            op.create_unique_constraint('uq_users_email', 'users', ['email'])
        except Exception:
            pass

    # 2. Create profiles table if not exists
    existing_tables = inspector.get_table_names()
    if 'profiles' not in existing_tables:
        op.create_table(
            'profiles',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False, index=True),
            sa.Column('mobile_number', sa.String(length=15), nullable=True),
            sa.Column('usn', sa.String(length=20), unique=True, nullable=True, index=True),
            sa.Column('sem', sa.Integer(), nullable=True),
            sa.Column('avatar_url', sa.String(length=500), nullable=True),
            sa.Column('bio', sa.String(length=500), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'profiles' in existing_tables:
        op.drop_table('profiles')

    existing_user_cols = [c['name'] for c in inspector.get_columns('users')]
    if 'deleted_at' in existing_user_cols:
        op.drop_column('users', 'deleted_at')
    if 'updated_at' in existing_user_cols:
        op.drop_column('users', 'updated_at')
    if 'email_verified_at' in existing_user_cols:
        op.drop_column('users', 'email_verified_at')
