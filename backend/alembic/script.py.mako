"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision = '${up_revision}'
down_revision = ${None if (not down_revision or down_revision in ('None', '')) else repr(down_revision)}
branch_labels = ${None if (not branch_labels or branch_labels in ('None', '')) else repr(branch_labels)}
depends_on = ${None if (not depends_on or depends_on in ('None', '')) else repr(depends_on)}


def upgrade():
    ${upgrades if upgrades else "pass"}


def downgrade():
    ${downgrades if downgrades else "pass"}
