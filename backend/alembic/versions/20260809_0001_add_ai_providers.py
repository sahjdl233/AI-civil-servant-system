"""add ai_providers table

Revision ID: 20260809_0001
Revises: 6565ea5b1c35
Create Date: 2026-08-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260809_0001'
down_revision: Union[str, None] = '6565ea5b1c35'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ai_providers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('provider_type', sa.String(length=50), nullable=False),
        sa.Column('base_url', sa.String(length=500), nullable=True),
        sa.Column('api_key', sa.String(length=500), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False),
        sa.Column('timeout', sa.Integer(), nullable=False),
        sa.Column('extra', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_providers_id'), 'ai_providers', ['id'], unique=False)
    op.create_index(op.f('ix_ai_providers_name'), 'ai_providers', ['name'], unique=False)
    op.create_index(op.f('ix_ai_providers_provider_type'), 'ai_providers', ['provider_type'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_providers_provider_type'), table_name='ai_providers')
    op.drop_index(op.f('ix_ai_providers_name'), table_name='ai_providers')
    op.drop_index(op.f('ix_ai_providers_id'), table_name='ai_providers')
    op.drop_table('ai_providers')
