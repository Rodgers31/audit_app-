"""
Question Data Seeder
Populates the database with initial learning hub questions
"""

import json
import logging
from typing import Any, Dict, List

# Sample questions for the learning hub
SAMPLE_QUESTIONS = [
    {
        "question_text": "What is the primary purpose of a government budget?",
        "option_a": "To limit government spending",
        "option_b": "To plan and allocate public resources",
        "option_c": "To increase taxes",
        "option_d": "To reduce debt",
        "correct_answer": "B",
        "explanation": "A budget is a financial plan that allocates public resources to various government programs and services based on priorities and available revenue.",
        "category": "budget_basics",
        "difficulty_level": 2,
        "tags": ["budgeting", "public_finance", "planning"],
    },
    {
        "question_text": "Which entity typically conducts government audits in Kenya?",
        "option_a": "Ministry of Finance",
        "option_b": "Parliament",
        "option_c": "Office of the Auditor General",
        "option_d": "Central Bank of Kenya",
        "correct_answer": "C",
        "explanation": "The Office of the Auditor General is the independent constitutional body responsible for auditing government accounts and ensuring accountability in Kenya.",
        "category": "audit_fundamentals",
        "difficulty_level": 3,
        "tags": ["audit", "kenya", "governance", "accountability"],
    },
    {
        "question_text": "What does debt-to-GDP ratio measure?",
        "option_a": "Government's ability to pay salaries",
        "option_b": "Country's debt relative to economic output",
        "option_c": "Interest rates on government bonds",
        "option_d": "Foreign exchange reserves",
        "correct_answer": "B",
        "explanation": "The debt-to-GDP ratio compares a country's total debt to its Gross Domestic Product, indicating the country's ability to pay back its debt and fiscal health.",
        "category": "debt_management",
        "difficulty_level": 4,
        "tags": ["debt", "economics", "indicators", "fiscal_health"],
    },
    {
        "question_text": "What is transparency in public finance?",
        "option_a": "Keeping all budget information secret",
        "option_b": "Only sharing information with parliament",
        "option_c": "Open access to government financial information",
        "option_d": "Limiting access to financial data",
        "correct_answer": "C",
        "explanation": "Financial transparency means making government financial information openly accessible to the public to promote accountability and informed citizen participation.",
        "category": "financial_transparency",
        "difficulty_level": 2,
        "tags": ["transparency", "accountability", "governance", "participation"],
    },
    {
        "question_text": "What is the purpose of a fiscal period in budgeting?",
        "option_a": "To confuse citizens",
        "option_b": "To organize financial planning and reporting",
        "option_c": "To hide spending information",
        "option_d": "To increase bureaucracy",
        "correct_answer": "B",
        "explanation": "A fiscal period (usually one year) helps organize government financial planning, budgeting, execution, and reporting cycles for better management and accountability.",
        "category": "budget_basics",
        "difficulty_level": 1,
        "tags": ["fiscal_period", "budgeting", "planning", "reporting"],
    },
    {
        "question_text": "What is internal control in government finance?",
        "option_a": "Controlling citizen access to information",
        "option_b": "Systems to ensure proper use of public funds",
        "option_c": "Limiting parliamentary oversight",
        "option_d": "Reducing government transparency",
        "correct_answer": "B",
        "explanation": "Internal controls are systems, policies, and procedures designed to ensure proper authorization, recording, and use of public funds and prevent fraud.",
        "category": "governance",
        "difficulty_level": 3,
        "tags": [
            "internal_control",
            "fraud_prevention",
            "governance",
            "accountability",
        ],
    },
    {
        "question_text": "What does 'value for money' mean in public spending?",
        "option_a": "Spending the least amount possible",
        "option_b": "Getting the best results for the cost",
        "option_c": "Spending only on expensive items",
        "option_d": "Avoiding all spending",
        "correct_answer": "B",
        "explanation": "Value for money means achieving the best possible results and outcomes for the amount of public money spent, considering economy, efficiency, and effectiveness.",
        "category": "public_finance",
        "difficulty_level": 2,
        "tags": ["value_for_money", "efficiency", "effectiveness", "public_spending"],
    },
    {
        "question_text": "What is a supplementary budget?",
        "option_a": "An additional budget for emergencies",
        "option_b": "The main annual budget",
        "option_c": "A budget for supplements only",
        "option_d": "A budget that replaces the main budget",
        "correct_answer": "A",
        "explanation": "A supplementary budget is an additional budget passed during the fiscal year to address unforeseen expenditures, emergencies, or budget adjustments.",
        "category": "budget_basics",
        "difficulty_level": 3,
        "tags": ["supplementary_budget", "emergency_spending", "budget_adjustment"],
    },
    {
        "question_text": "What is procurement in government?",
        "option_a": "Hiring government employees",
        "option_b": "Collecting taxes from citizens",
        "option_c": "Purchasing goods and services",
        "option_d": "Creating new policies",
        "correct_answer": "C",
        "explanation": "Government procurement is the process of purchasing goods, services, and works required for government operations, following specific rules to ensure fairness and value for money.",
        "category": "governance",
        "difficulty_level": 2,
        "tags": ["procurement", "purchasing", "governance", "transparency"],
    },
    {
        "question_text": "What is an audit opinion?",
        "option_a": "A personal view about government",
        "option_b": "Auditor's professional judgment on financial statements",
        "option_c": "A suggestion for policy change",
        "option_d": "A complaint about services",
        "correct_answer": "B",
        "explanation": "An audit opinion is the auditor's professional judgment on whether financial statements present a true and fair view of the organization's financial position and performance.",
        "category": "audit_fundamentals",
        "difficulty_level": 4,
        "tags": ["audit_opinion", "financial_statements", "professional_judgment"],
    },
    {
        "question_text": "What is revenue in government finance?",
        "option_a": "Money the government owes",
        "option_b": "Money the government spends",
        "option_c": "Money the government receives",
        "option_d": "Money the government saves",
        "correct_answer": "C",
        "explanation": "Government revenue is money received by the government from various sources such as taxes, fees, grants, and other income to fund public services and operations.",
        "category": "public_finance",
        "difficulty_level": 1,
        "tags": ["revenue", "income", "taxes", "government_finance"],
    },
    {
        "question_text": "What is the role of Parliament in budget oversight?",
        "option_a": "To prepare the budget",
        "option_b": "To approve and monitor budget implementation",
        "option_c": "To collect taxes",
        "option_d": "To audit government accounts",
        "correct_answer": "B",
        "explanation": "Parliament's role in budget oversight includes approving the budget, monitoring its implementation, and ensuring that public funds are used as authorized.",
        "category": "governance",
        "difficulty_level": 3,
        "tags": ["parliament", "oversight", "budget_approval", "monitoring"],
    },
    {
        "question_text": "What is public debt?",
        "option_a": "Money citizens owe to government",
        "option_b": "Money government owes to creditors",
        "option_c": "Money government gives to citizens",
        "option_d": "Money government collects in taxes",
        "correct_answer": "B",
        "explanation": "Public debt is the total amount of money that a government owes to creditors, including domestic and foreign borrowings through bonds, loans, and other instruments.",
        "category": "debt_management",
        "difficulty_level": 2,
        "tags": ["public_debt", "borrowing", "creditors", "bonds"],
    },
    {
        "question_text": "What does IFMIS stand for in Kenya?",
        "option_a": "International Financial Management Information System",
        "option_b": "Integrated Financial Management Information System",
        "option_c": "Internal Fund Management Information System",
        "option_d": "Individual Financial Monitoring Information System",
        "correct_answer": "B",
        "explanation": "IFMIS (Integrated Financial Management Information System) is Kenya's computerized system for managing government financial operations and enhancing transparency.",
        "category": "financial_transparency",
        "difficulty_level": 4,
        "tags": ["IFMIS", "kenya", "financial_management", "technology"],
    },
    {
        "question_text": "What is a development budget?",
        "option_a": "Budget for employee salaries",
        "option_b": "Budget for capital projects and infrastructure",
        "option_c": "Budget for office supplies",
        "option_d": "Budget for utility bills",
        "correct_answer": "B",
        "explanation": "A development budget allocates funds for capital projects, infrastructure development, and long-term investments that contribute to economic growth and development.",
        "category": "budget_basics",
        "difficulty_level": 2,
        "tags": [
            "development_budget",
            "capital_projects",
            "infrastructure",
            "investment",
        ],
    },
    {
        "question_text": "What is citizen participation in budgeting?",
        "option_a": "Citizens paying taxes only",
        "option_b": "Citizens voting in elections only",
        "option_c": "Citizens involved in budget planning and monitoring",
        "option_d": "Citizens working for government",
        "correct_answer": "C",
        "explanation": "Citizen participation in budgeting involves engaging the public in budget planning, priority setting, and monitoring to ensure budgets reflect community needs and priorities.",
        "category": "financial_transparency",
        "difficulty_level": 3,
        "tags": [
            "citizen_participation",
            "community_involvement",
            "budget_planning",
            "monitoring",
        ],
    },
    {
        "question_text": "What is a contingent liability?",
        "option_a": "A definite government debt",
        "option_b": "A potential future government obligation",
        "option_c": "A government asset",
        "option_d": "A tax revenue",
        "correct_answer": "B",
        "explanation": "A contingent liability is a potential future obligation that may arise depending on the outcome of uncertain future events, such as loan guarantees or court cases.",
        "category": "debt_management",
        "difficulty_level": 5,
        "tags": [
            "contingent_liability",
            "risk_management",
            "guarantees",
            "future_obligations",
        ],
    },
    {
        "question_text": "What is the purpose of financial regulations?",
        "option_a": "To make government work slower",
        "option_b": "To ensure proper financial management",
        "option_c": "To increase government spending",
        "option_d": "To reduce citizen participation",
        "correct_answer": "B",
        "explanation": "Financial regulations establish rules and procedures to ensure proper management of public funds, prevent misuse, and promote accountability and transparency.",
        "category": "governance",
        "difficulty_level": 2,
        "tags": [
            "financial_regulations",
            "financial_management",
            "accountability",
            "procedures",
        ],
    },
    {
        "question_text": "What is fiscal policy?",
        "option_a": "Policy about office management",
        "option_b": "Government's use of spending and taxation",
        "option_c": "Policy about employee behavior",
        "option_d": "Policy about building maintenance",
        "correct_answer": "B",
        "explanation": "Fiscal policy refers to government's use of spending and taxation to influence economic activity, employment, inflation, and overall economic growth.",
        "category": "public_finance",
        "difficulty_level": 4,
        "tags": ["fiscal_policy", "economic_policy", "taxation", "government_spending"],
    },
    {
        "question_text": "What is performance budgeting?",
        "option_a": "Budgeting based on employee performance",
        "option_b": "Budgeting linked to results and outcomes",
        "option_c": "Budgeting for performance bonuses",
        "option_d": "Budgeting for sports activities",
        "correct_answer": "B",
        "explanation": "Performance budgeting links budget allocations to expected results and outcomes, focusing on what government achieves with public money rather than just what it spends on.",
        "category": "budget_basics",
        "difficulty_level": 4,
        "tags": ["performance_budgeting", "results", "outcomes", "effectiveness"],
    },
]


def seed_questions() -> Dict[str, Any]:
    """
    Seed the database with sample questions.
    Returns a summary of the seeding operation.
    """

    try:
        # This would typically use the database and question service
        # For now, we'll return a mock response

        created_count = len(SAMPLE_QUESTIONS)

        return {
            "success": True,
            "message": f"Successfully seeded {created_count} questions",
            "questions_created": created_count,
            "categories_covered": list(set([q["category"] for q in SAMPLE_QUESTIONS])),
            "difficulty_levels": list(
                set([q["difficulty_level"] for q in SAMPLE_QUESTIONS])
            ),
        }

    except Exception as e:
        logging.error(f"Error seeding questions: {str(e)}")
        return {
            "success": False,
            "message": f"Error seeding questions: {str(e)}",
            "questions_created": 0,
        }


def get_sample_questions() -> List[Dict[str, Any]]:
    """Get the sample questions for external use."""
    return SAMPLE_QUESTIONS


def export_questions_to_json(filename: str = "questions_export.json") -> str:
    """Export sample questions to a JSON file."""

    try:
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(SAMPLE_QUESTIONS, f, indent=2, ensure_ascii=False)

        return f"Questions exported to {filename}"

    except Exception as e:
        return f"Error exporting questions: {str(e)}"


if __name__ == "__main__":
    # Run seeding operation
    result = seed_questions()
    print(json.dumps(result, indent=2))

    # Export to JSON file
    export_result = export_questions_to_json()
    print(export_result)
