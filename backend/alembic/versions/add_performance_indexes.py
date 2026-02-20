"""Database migration to add indexes for performance optimization."""

from alembic import op

revision = "add_performance_indexes"
down_revision = "63ca92d190e7"  # Previous migration
branch_labels = None
depends_on = None


def upgrade():
    """Add indexes for better query performance."""

    # Budget Lines indexes
    op.create_index(
        "ix_budget_lines_entity_period",
        "budget_lines",
        ["entity_id", "period_id"],
        unique=False,
    )
    op.create_index(
        "ix_budget_lines_category", "budget_lines", ["category"], unique=False
    )
    op.create_index(
        "ix_budget_lines_source_doc",
        "budget_lines",
        ["source_document_id"],
        unique=False,
    )

    # Audits indexes
    op.create_index(
        "ix_audits_entity_period", "audits", ["entity_id", "period_id"], unique=False
    )
    op.create_index("ix_audits_severity", "audits", ["severity"], unique=False)
    op.create_index(
        "ix_audits_source_doc", "audits", ["source_document_id"], unique=False
    )

    # Loans indexes
    op.create_index("ix_loans_entity", "loans", ["entity_id"], unique=False)
    op.create_index("ix_loans_lender", "loans", ["lender"], unique=False)

    # Entities indexes
    op.create_index("ix_entities_type", "entities", ["type"], unique=False)
    op.create_index("ix_entities_country", "entities", ["country_id"], unique=False)

    # Source Documents indexes
    op.create_index(
        "ix_source_documents_country", "source_documents", ["country_id"], unique=False
    )
    op.create_index(
        "ix_source_documents_type", "source_documents", ["doc_type"], unique=False
    )
    op.create_index(
        "ix_source_documents_fetch_date",
        "source_documents",
        ["fetch_date"],
        unique=False,
    )

    # Extractions indexes
    op.create_index(
        "ix_extractions_source_doc", "extractions", ["source_document_id"], unique=False
    )

    # Fiscal Periods indexes
    op.create_index(
        "ix_fiscal_periods_country", "fiscal_periods", ["country_id"], unique=False
    )
    op.create_index(
        "ix_fiscal_periods_dates",
        "fiscal_periods",
        ["start_date", "end_date"],
        unique=False,
    )


def downgrade():
    """Remove indexes."""

    # Budget Lines
    op.drop_index("ix_budget_lines_entity_period", table_name="budget_lines")
    op.drop_index("ix_budget_lines_category", table_name="budget_lines")
    op.drop_index("ix_budget_lines_source_doc", table_name="budget_lines")

    # Audits
    op.drop_index("ix_audits_entity_period", table_name="audits")
    op.drop_index("ix_audits_severity", table_name="audits")
    op.drop_index("ix_audits_source_doc", table_name="audits")

    # Loans
    op.drop_index("ix_loans_entity", table_name="loans")
    op.drop_index("ix_loans_lender", table_name="loans")

    # Entities
    op.drop_index("ix_entities_type", table_name="entities")
    op.drop_index("ix_entities_country", table_name="entities")

    # Source Documents
    op.drop_index("ix_source_documents_country", table_name="source_documents")
    op.drop_index("ix_source_documents_type", table_name="source_documents")
    op.drop_index("ix_source_documents_fetch_date", table_name="source_documents")

    # Extractions
    op.drop_index("ix_extractions_source_doc", table_name="extractions")

    # Fiscal Periods
    op.drop_index("ix_fiscal_periods_country", table_name="fiscal_periods")
    op.drop_index("ix_fiscal_periods_dates", table_name="fiscal_periods")
