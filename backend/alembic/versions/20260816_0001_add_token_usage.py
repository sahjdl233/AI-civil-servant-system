"""add token_usage table

Revision ID: 20260816_0001
Revises: 20260813_0001
Create Date: 2026-08-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260816_0001'
down_revision: Union[str, None] = '20260813_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'token_usage',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('provider_id', sa.String(), nullable=True),
        sa.Column('provider_name', sa.String(), nullable=False),
        sa.Column('provider_type', sa.String(length=50), nullable=True),
        sa.Column('model', sa.String(length=100), nullable=True),
        sa.Column('scene', sa.String(length=50), nullable=True),
        sa.Column('prompt_tokens', sa.Integer(), nullable=False),
        sa.Column('completion_tokens', sa.Integer(), nullable=False),
        sa.Column('total_tokens', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_token_usage_id'), 'token_usage', ['id'], unique=False)
    op.create_index(op.f('ix_token_usage_provider_id'), 'token_usage', ['provider_id'], unique=False)
    op.create_index(op.f('ix_token_usage_scene'), 'token_usage', ['scene'], unique=False)
    op.create_index(op.f('ix_token_usage_created_at'), 'token_usage', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_token_usage_created_at'), table_name='token_usage')
    op.drop_index(op.f('ix_token_usage_scene'), table_name='token_usage')
    op.drop_index(op.f('ix_token_usage_provider_id'), table_name='token_usage')
    op.drop_index(op.f('ix_token_usage_id'), table_name='token_usage')
    op.drop_table('token_usage')
