"""
Rule-based P0/P1/P2/Irrelevant scoring for prospects.
Priority = f(company_type_score, role_score)
"""

from ..models.prospect import Priority, CompanyType

# Company type → score (0-3)
COMPANY_TYPE_SCORES: dict[CompanyType, int] = {
    CompanyType.banking: 3,
    CompanyType.fintech: 3,
    CompanyType.financial_services: 3,
    CompanyType.nbfc: 2,
    CompanyType.insurance: 2,
    CompanyType.other: 0,
}

# Keywords that indicate high-value roles
P0_ROLE_KEYWORDS = [
    "chief credit officer", "cco", "head of credit", "chief risk officer", "cro",
    "vp credit", "vp risk", "director credit", "director risk",
    "head of lending", "chief lending officer",
    "head of collections", "vp collections",
    "md", "managing director", "ceo", "founder", "co-founder",
]

P1_ROLE_KEYWORDS = [
    "credit manager", "risk manager", "credit analyst", "credit operations",
    "credit underwriting", "underwriting manager", "credit head",
    "operations manager", "ops manager", "credit officer",
    "risk analyst", "risk officer", "portfolio manager",
    "loan operations", "lending operations", "collections manager",
    "fintech lead", "digital lending",
]

IRRELEVANT_ROLE_KEYWORDS = [
    "intern", "student", "marketing", "sales", "hr", "human resources",
    "recruiter", "talent", "pr ", "public relations", "design", "designer",
    "ux", "ui ", "brand", "social media", "content", "journalist",
    "analyst intern",
]


def classify_company_type(company_name: str) -> CompanyType:
    """Infer company type from name if not provided."""
    name_lower = company_name.lower()
    banking_keywords = ["bank", "banco", "banque", "sbi", "hdfc", "icici", "axis", "kotak", "pnb", "ubi", "rbl"]
    fintech_keywords = ["fintech", "lend", "credit", "pay", "wallet", "neobank", "razorpay", "paytm", "cred", "slice", "uni", "jupiter"]
    nbfc_keywords = ["nbfc", "finance", "capital", "invest", "asset", "leasing"]
    insurance_keywords = ["insurance", "insure", "life ", "general insurance", "reinsur"]
    fs_keywords = ["financial services", "wealth", "advisory", "consulting", "brokerage"]

    if any(k in name_lower for k in banking_keywords):
        return CompanyType.banking
    if any(k in name_lower for k in fintech_keywords):
        return CompanyType.fintech
    if any(k in name_lower for k in insurance_keywords):
        return CompanyType.insurance
    if any(k in name_lower for k in nbfc_keywords):
        return CompanyType.nbfc
    if any(k in name_lower for k in fs_keywords):
        return CompanyType.financial_services
    return CompanyType.other


def score_prospect(title: str, company_type: CompanyType) -> tuple[Priority, str]:
    """
    Returns (priority, reason_string).
    """
    title_lower = title.lower()

    # Irrelevant roles are irrelevant regardless of company
    if any(k in title_lower for k in IRRELEVANT_ROLE_KEYWORDS):
        return Priority.irrelevant, f"Role '{title}' is not in target persona"

    company_score = COMPANY_TYPE_SCORES.get(company_type, 0)

    # No relevant company → irrelevant
    if company_score == 0:
        return Priority.irrelevant, f"Company type '{company_type}' is not in target segment"

    is_p0_role = any(k in title_lower for k in P0_ROLE_KEYWORDS)
    is_p1_role = any(k in title_lower for k in P1_ROLE_KEYWORDS)

    if company_score >= 3 and is_p0_role:
        return Priority.P0, f"Senior decision-maker ({title}) at core target company ({company_type})"
    if company_score >= 2 and is_p0_role:
        return Priority.P0, f"Senior decision-maker ({title}) at high-value company ({company_type})"
    if company_score >= 3 and is_p1_role:
        return Priority.P1, f"Target role ({title}) at core company ({company_type})"
    if company_score >= 2 and is_p1_role:
        return Priority.P1, f"Target role ({title}) at relevant company ({company_type})"
    if company_score >= 3:
        return Priority.P2, f"Relevant company ({company_type}) but role ({title}) needs review"
    if is_p1_role or is_p0_role:
        return Priority.P2, f"Target role ({title}) but company type ({company_type}) is tier-2"

    return Priority.P2, f"Low-confidence match — manual review recommended"
