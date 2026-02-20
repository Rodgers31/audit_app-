import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class EntityType(enum.Enum):
    NATIONAL = "national"
    COUNTY = "county"
    MINISTRY = "ministry"
    AGENCY = "agency"
    MUNICIPALITY = "municipality"


class DebtCategory(enum.Enum):
    """Categories of government debt per Treasury classification."""

    EXTERNAL_MULTILATERAL = "external_multilateral"  # World Bank, IMF, AfDB, etc.
    EXTERNAL_BILATERAL = "external_bilateral"  # China, Japan, France, etc.
    EXTERNAL_COMMERCIAL = "external_commercial"  # Eurobonds, syndicated loans
    DOMESTIC_BONDS = "domestic_bonds"  # Treasury bonds (long-term)
    DOMESTIC_BILLS = "domestic_bills"  # Treasury bills (short-term)
    DOMESTIC_OVERDRAFT = "domestic_overdraft"  # CBK overdraft facility
    PENDING_BILLS = "pending_bills"  # Accumulated arrears/pending bills
    COUNTY_GUARANTEED = "county_guaranteed"  # County government guaranteed debt
    OTHER = "other"


class DocumentType(enum.Enum):
    BUDGET = "budget"
    AUDIT = "audit"
    REPORT = "report"
    LOAN = "loan"
    OTHER = "other"


class DocumentStatus(enum.Enum):
    AVAILABLE = "available"
    ARCHIVED = "archived"
    FAILED = "failed"


class Severity(enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class Country(Base):
    __tablename__ = "countries"

    id = Column(Integer, primary_key=True, index=True)
    iso_code = Column(String(3), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    currency = Column(String(3), nullable=False)
    timezone = Column(String(50), nullable=False)
    default_locale = Column(String(10), nullable=False)
    meta = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    entities = relationship("Entity", back_populates="country")
    fiscal_periods = relationship("FiscalPeriod", back_populates="country")
    source_documents = relationship("SourceDocument", back_populates="country")


class Entity(Base):
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=False)
    type = Column(Enum(EntityType), nullable=False)
    canonical_name = Column(String(200), nullable=False)
    slug = Column(String(200), unique=True, index=True, nullable=False)
    alt_names = Column(JSONB, default=list)
    meta = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    country = relationship("Country", back_populates="entities")
    budget_lines = relationship("BudgetLine", back_populates="entity")
    loans = relationship("Loan", back_populates="entity")
    audits = relationship("Audit", back_populates="entity")


class FiscalPeriod(Base):
    __tablename__ = "fiscal_periods"

    id = Column(Integer, primary_key=True, index=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=False)
    label = Column(String(50), nullable=False)  # e.g., "FY2024/25"
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    country = relationship("Country", back_populates="fiscal_periods")
    budget_lines = relationship("BudgetLine", back_populates="period")
    audits = relationship("Audit", back_populates="period")


class SourceDocument(Base):
    __tablename__ = "source_documents"

    id = Column(Integer, primary_key=True, index=True)
    country_id = Column(Integer, ForeignKey("countries.id"), nullable=False)
    publisher = Column(String(200), nullable=False)
    title = Column(String(500), nullable=False)
    url = Column(Text, nullable=True)
    file_path = Column(Text, nullable=True)
    fetch_date = Column(DateTime, nullable=False)
    md5 = Column(String(32), nullable=True)
    doc_type = Column(Enum(DocumentType), nullable=False)
    status = Column(
        Enum(DocumentStatus), nullable=False, default=DocumentStatus.AVAILABLE
    )
    last_seen_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    meta = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    country = relationship("Country", back_populates="source_documents")
    extractions = relationship("Extraction", back_populates="source_document")
    budget_lines = relationship("BudgetLine", back_populates="source_document")
    loans = relationship("Loan", back_populates="source_document")
    audits = relationship("Audit", back_populates="source_document")


class Extraction(Base):
    __tablename__ = "extractions"

    id = Column(Integer, primary_key=True, index=True)
    source_document_id = Column(
        Integer, ForeignKey("source_documents.id"), nullable=False
    )
    page_number = Column(Integer, nullable=True)
    extracted_json = Column(JSONB, nullable=False)
    extractor = Column(String(50), nullable=False)  # camelot/tabula/pdfplumber
    confidence = Column(Numeric(3, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    source_document = relationship("SourceDocument", back_populates="extractions")


class BudgetLine(Base):
    __tablename__ = "budget_lines"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    period_id = Column(Integer, ForeignKey("fiscal_periods.id"), nullable=False)
    category = Column(String(200), nullable=False)
    subcategory = Column(String(200), nullable=True)
    allocated_amount = Column(Numeric(15, 2), nullable=True)
    actual_spent = Column(Numeric(15, 2), nullable=True)
    committed_amount = Column(Numeric(15, 2), nullable=True)
    currency = Column(String(3), nullable=False)
    source_document_id = Column(
        Integer, ForeignKey("source_documents.id"), nullable=False
    )
    page_ref = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    provenance = Column(JSONB, default=list)  # List of source references
    source_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    entity = relationship("Entity", back_populates="budget_lines")
    period = relationship("FiscalPeriod", back_populates="budget_lines")
    source_document = relationship("SourceDocument", back_populates="budget_lines")
    annotations = relationship(
        "Annotation",
        back_populates="budget_line",
        primaryjoin="and_(Annotation.ref_type=='budget_line', Annotation.ref_id==BudgetLine.id)",
        foreign_keys="[Annotation.ref_id]",
    )


class Loan(Base):
    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    lender = Column(String(200), nullable=False)
    debt_category = Column(
        Enum(DebtCategory), nullable=True, default=DebtCategory.OTHER
    )
    principal = Column(Numeric(15, 2), nullable=False)
    outstanding = Column(Numeric(15, 2), nullable=False)
    interest_rate = Column(Numeric(5, 2), nullable=True)  # Annual interest rate %
    issue_date = Column(DateTime, nullable=False)
    maturity_date = Column(DateTime, nullable=True)
    currency = Column(String(3), nullable=False)
    source_document_id = Column(
        Integer, ForeignKey("source_documents.id"), nullable=False
    )
    provenance = Column(JSONB, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    entity = relationship("Entity", back_populates="loans")
    source_document = relationship("SourceDocument", back_populates="loans")


class Audit(Base):
    __tablename__ = "audits"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False)
    period_id = Column(Integer, ForeignKey("fiscal_periods.id"), nullable=False)
    finding_text = Column(Text, nullable=False)
    severity = Column(Enum(Severity), nullable=False)
    recommended_action = Column(Text, nullable=True)
    source_document_id = Column(
        Integer, ForeignKey("source_documents.id"), nullable=False
    )
    provenance = Column(JSONB, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    entity = relationship("Entity", back_populates="audits")
    period = relationship("FiscalPeriod", back_populates="audits")
    source_document = relationship("SourceDocument", back_populates="audits")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    roles = Column(JSONB, default=list)
    disabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    annotations = relationship("Annotation", back_populates="user")
    question_answers = relationship("UserQuestionAnswer", back_populates="user")


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ref_type = Column(String(20), nullable=False)  # budget_line, audit, loan
    ref_id = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    public = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="annotations")
    budget_line = relationship(
        "BudgetLine",
        back_populates="annotations",
        foreign_keys="[Annotation.ref_id]",
        primaryjoin="and_(Annotation.ref_type=='budget_line', "
        "Annotation.ref_id==BudgetLine.id)",
    )


class QuestionCategory(enum.Enum):
    BUDGET_BASICS = "budget_basics"
    AUDIT_FUNDAMENTALS = "audit_fundamentals"
    DEBT_MANAGEMENT = "debt_management"
    FINANCIAL_TRANSPARENCY = "financial_transparency"
    GOVERNANCE = "governance"
    PUBLIC_FINANCE = "public_finance"


class QuickQuestion(Base):
    __tablename__ = "quick_questions"

    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    category = Column(Enum(QuestionCategory), nullable=False)
    difficulty_level = Column(Integer, nullable=False, default=1)  # 1-5 scale
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    source_url = Column(String(500), nullable=True)
    tags = Column(JSONB, default=list)

    # Relationships
    user_answers = relationship("UserQuestionAnswer", back_populates="question")


class UserQuestionAnswer(Base):
    __tablename__ = "user_question_answers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("quick_questions.id"), nullable=False)
    selected_answer = Column(String(1), nullable=False)  # A, B, C, or D
    is_correct = Column(Boolean, nullable=False)
    answered_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="question_answers")
    question = relationship("QuickQuestion", back_populates="user_answers")


# ===== KNBS Economic Data Models =====


class PopulationData(Base):
    """Population data from KNBS (Kenya National Bureau of Statistics)."""

    __tablename__ = "population_data"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(
        Integer, ForeignKey("entities.id"), nullable=True
    )  # County or national
    year = Column(Integer, nullable=False, index=True)
    total_population = Column(Integer, nullable=False)
    male_population = Column(Integer, nullable=True)
    female_population = Column(Integer, nullable=True)
    urban_population = Column(Integer, nullable=True)
    rural_population = Column(Integer, nullable=True)
    population_density = Column(Numeric(10, 2), nullable=True)  # People per sq km
    source_document_id = Column(
        Integer, ForeignKey("source_documents.id"), nullable=True
    )
    source_page = Column(Integer, nullable=True)
    confidence = Column(Numeric(3, 2), nullable=True, default=1.0)
    meta = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    entity = relationship("Entity")
    source_document = relationship("SourceDocument")


class GDPData(Base):
    """GDP and Gross County Product data from KNBS."""

    __tablename__ = "gdp_data"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(
        Integer, ForeignKey("entities.id"), nullable=True
    )  # NULL for national, county_id for GCP
    year = Column(Integer, nullable=False, index=True)
    quarter = Column(String(2), nullable=True, index=True)  # Q1, Q2, Q3, Q4
    gdp_value = Column(Numeric(20, 2), nullable=False)  # KES
    gdp_growth_rate = Column(Numeric(5, 2), nullable=True)  # Percentage
    currency = Column(String(3), nullable=False, default="KES")
    source_document_id = Column(
        Integer, ForeignKey("source_documents.id"), nullable=True
    )
    source_page = Column(Integer, nullable=True)
    confidence = Column(Numeric(3, 2), nullable=True, default=1.0)
    meta = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    entity = relationship("Entity")
    source_document = relationship("SourceDocument")


class EconomicIndicator(Base):
    """Economic indicators from KNBS (CPI, PPI, inflation, unemployment, etc.)."""

    __tablename__ = "economic_indicators"

    id = Column(Integer, primary_key=True, index=True)
    indicator_type = Column(
        String(50), nullable=False, index=True
    )  # CPI, PPI, inflation_rate, unemployment_rate
    indicator_date = Column(DateTime, nullable=False, index=True)
    value = Column(Numeric(10, 2), nullable=False)
    entity_id = Column(
        Integer, ForeignKey("entities.id"), nullable=True
    )  # NULL for national, county_id for county-level
    unit = Column(String(20), nullable=True)  # percent, index, etc.
    source_document_id = Column(
        Integer, ForeignKey("source_documents.id"), nullable=True
    )
    source_page = Column(Integer, nullable=True)
    confidence = Column(Numeric(3, 2), nullable=True, default=1.0)
    meta = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    entity = relationship("Entity")
    source_document = relationship("SourceDocument")


class IngestionStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPLETED_WITH_ERRORS = "completed_with_errors"
    FAILED = "failed"


class IngestionJob(Base):
    """Track each seeding domain execution for observability."""

    __tablename__ = "ingestion_jobs"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(100), nullable=False, index=True)
    status = Column(
        Enum(IngestionStatus), nullable=False, default=IngestionStatus.PENDING
    )
    dry_run = Column(Boolean, nullable=False, default=False)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    items_processed = Column(Integer, nullable=False, default=0)
    items_created = Column(Integer, nullable=False, default=0)
    items_updated = Column(Integer, nullable=False, default=0)
    errors = Column(JSONB, default=list)
    meta = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)


class PovertyIndex(Base):
    """Poverty indices from KNBS."""

    __tablename__ = "poverty_indices"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(
        Integer, ForeignKey("entities.id"), nullable=True
    )  # County or national
    year = Column(Integer, nullable=False, index=True)
    poverty_headcount_rate = Column(Numeric(5, 2), nullable=True)  # Percentage
    extreme_poverty_rate = Column(Numeric(5, 2), nullable=True)  # Percentage
    gini_coefficient = Column(Numeric(4, 3), nullable=True)  # 0-1 scale
    source_document_id = Column(
        Integer, ForeignKey("source_documents.id"), nullable=True
    )
    source_page = Column(Integer, nullable=True)
    confidence = Column(Numeric(3, 2), nullable=True, default=1.0)
    meta = Column("metadata", JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    entity = relationship("Entity")
    source_document = relationship("SourceDocument")
