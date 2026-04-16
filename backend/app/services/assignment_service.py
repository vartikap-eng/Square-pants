"""
Owner assignment and outreach mode determination
"""
from typing import List, Dict
from ..models.prospect import Priority, Segment

# Team members by role
BDR_TEAM = ["Sarah Chen (BDR)", "Mike Johnson (BDR)", "Priya Sharma (BDR)", "Alex Kim (BDR)"]
SENIOR_TEAM = ["David Martinez (VP Sales)", "Jennifer Lee (Director)", "Rahul Patel (Senior AE)"]

def assign_owner(priority: Priority, segment: Segment, company_name: str = "") -> str:
    """
    Assign owner based on priority and segment

    Rules:
    - Existing clients / Pipeline → Senior team members
    - Cold leads (P0) → Round robin BDR team
    - Cold leads (P1/P2) → Round robin BDR team
    """
    if segment in [Segment.existing_client, Segment.pipeline]:
        # Existing/pipeline goes to senior team
        # Use hash for consistent assignment
        idx = hash(company_name) % len(SENIOR_TEAM)
        return SENIOR_TEAM[idx]
    else:
        # Cold leads go to BDR team
        # P0 gets first in rotation, others distributed
        if priority == Priority.P0:
            idx = hash(company_name) % len(BDR_TEAM)
        else:
            idx = (hash(company_name) + ord(priority.value[1])) % len(BDR_TEAM)
        return BDR_TEAM[idx]


def get_outreach_mode(segment: Segment, priority: Priority) -> str:
    """
    Determine outreach mode based on segment and priority

    Returns:
    - "Senior Direct Call" - for existing clients/pipeline
    - "Personalized Email" - for existing clients follow-up
    - "BDR Multi-touch" - for cold P0 leads
    - "BDR Email Sequence" - for cold P1/P2 leads
    """
    if segment == Segment.existing_client:
        return "Senior Direct Call"
    elif segment == Segment.pipeline:
        return "Personalized Email"
    elif segment == Segment.cold:
        if priority == Priority.P0:
            return "BDR Multi-touch"
        else:
            return "BDR Email Sequence"

    return "BDR Email Sequence"


def get_icp_reasoning(
    company_name: str,
    company_type: str,
    title: str,
    priority: Priority,
    score_reason: str = ""
) -> dict:
    """
    Generate ICP (Ideal Customer Profile) reasoning for a prospect

    Returns detailed explanation of:
    - Why they're an ICP
    - How they're relevant to HyperVerge
    - Specific pain points HyperVerge solves
    """

    # Company type insights
    company_insights = {
        "banking": {
            "fit": "Perfect Fit - Tier 1 ICP",
            "why": "Banks are heavily regulated and face constant scrutiny from regulators on KYC/AML compliance. They process thousands of customer onboardings monthly and need automated verification.",
            "pain_points": [
                "Manual KYC review processes taking 3-5 days per customer",
                "High false positive rates in identity verification",
                "Regulatory penalties for AML violations",
                "Growing customer drop-off due to lengthy onboarding"
            ],
            "hyperverge_solution": "HyperVerge's AI-powered KYC platform reduces verification time from days to minutes with 99%+ accuracy, helping banks onboard customers faster while maintaining compliance."
        },
        "insurance": {
            "fit": "Perfect Fit - Tier 1 ICP",
            "why": "Insurance companies need robust identity verification for policy applications and claims processing. Fraud prevention is critical.",
            "pain_points": [
                "Insurance fraud costing billions annually",
                "Slow policy issuance due to manual verification",
                "Poor customer experience in digital channels",
                "Compliance with Know Your Customer regulations"
            ],
            "hyperverge_solution": "HyperVerge provides real-time identity verification and fraud detection, enabling instant policy issuance while preventing fraudulent claims."
        },
        "fintech": {
            "fit": "Strong Fit - Tier 2 ICP",
            "why": "Fintechs operate in regulated environments and need scalable digital KYC to grow quickly while staying compliant.",
            "pain_points": [
                "Scaling customer onboarding without increasing costs",
                "Balancing fraud prevention with user experience",
                "Meeting regulatory requirements across jurisdictions",
                "High customer acquisition costs due to drop-offs"
            ],
            "hyperverge_solution": "HyperVerge's API-first platform integrates in hours, providing automated KYC that scales with growth while maintaining 95%+ pass rates."
        },
        "financial_services": {
            "fit": "Good Fit - Tier 2 ICP",
            "why": "Financial services companies handle sensitive transactions and customer data, requiring strong identity verification.",
            "pain_points": [
                "Manual review bottlenecks in customer onboarding",
                "Identity fraud and account takeovers",
                "Regulatory compliance overhead",
                "Customer friction in verification processes"
            ],
            "hyperverge_solution": "HyperVerge automates identity verification with AI, reducing manual review by 80% while improving fraud detection."
        },
        "nbfc": {
            "fit": "Good Fit - Tier 2 ICP",
            "why": "NBFCs need efficient KYC processes to scale lending operations while meeting RBI compliance requirements.",
            "pain_points": [
                "High customer acquisition costs",
                "Slow loan disbursement due to KYC delays",
                "Regulatory compliance burden",
                "Limited resources for manual verification"
            ],
            "hyperverge_solution": "HyperVerge enables instant loan disbursement with automated KYC, helping NBFCs scale without adding verification staff."
        },
        "other": {
            "fit": "Potential Fit - Requires Evaluation",
            "why": "Company operates in financial services space and may have identity verification needs.",
            "pain_points": [
                "Customer onboarding efficiency",
                "Identity fraud prevention",
                "Regulatory compliance"
            ],
            "hyperverge_solution": "HyperVerge provides enterprise-grade identity verification solutions tailored to financial services."
        }
    }

    # Role/title insights
    role_insights = {
        "compliance": {
            "decision_authority": "Primary Decision Maker",
            "why": "Compliance officers own the budget and decision-making for regulatory technology. They're measured on audit results and regulatory penalties.",
            "buying_triggers": [
                "Upcoming regulatory audits",
                "Recent compliance violations or warnings",
                "New regulations requiring enhanced KYC",
                "Board pressure to improve compliance posture"
            ],
            "messaging": "Focus on audit readiness, regulatory compliance, and reducing penalty risk."
        },
        "risk": {
            "decision_authority": "Primary Decision Maker",
            "why": "Risk officers are accountable for fraud losses and operational risk. They prioritize solutions that reduce financial exposure.",
            "buying_triggers": [
                "Rising fraud losses",
                "New fraud attack vectors",
                "Board reporting on risk metrics",
                "Cyber insurance requirements"
            ],
            "messaging": "Emphasize fraud prevention, false positive reduction, and ROI from loss prevention."
        },
        "operations": {
            "decision_authority": "Key Influencer",
            "why": "Operations leaders feel the pain of manual processes and are looking for efficiency gains. They influence but may not own final budget.",
            "buying_triggers": [
                "Operational bottlenecks",
                "Customer complaints about onboarding time",
                "Rising operational costs",
                "Pressure to do more with less"
            ],
            "messaging": "Highlight time savings, cost reduction, and improved customer experience."
        },
        "finance": {
            "decision_authority": "Key Influencer",
            "why": "Finance leaders control budgets and care about ROI, cost savings, and operational efficiency.",
            "buying_triggers": [
                "Budget planning cycles",
                "Cost reduction initiatives",
                "Scaling challenges",
                "Need to justify headcount"
            ],
            "messaging": "Focus on cost per verification, headcount savings, and clear ROI."
        },
        "technology": {
            "decision_authority": "Technical Evaluator",
            "why": "Technology leaders evaluate integration complexity, security, and scalability. They don't own budget but have veto power.",
            "buying_triggers": [
                "Digital transformation initiatives",
                "Legacy system modernization",
                "API integration requirements",
                "Security and compliance mandates"
            ],
            "messaging": "Emphasize API ease, security certifications, scalability, and technical support."
        }
    }

    # Determine role category from title
    title_lower = title.lower()
    role_category = "operations"
    if any(word in title_lower for word in ["compliance", "kyc", "aml"]):
        role_category = "compliance"
    elif "risk" in title_lower:
        role_category = "risk"
    elif any(word in title_lower for word in ["cto", "cio", "technology", "engineering"]):
        role_category = "technology"
    elif any(word in title_lower for word in ["cfo", "finance", "director of finance"]):
        role_category = "finance"

    company_type_key = company_type if company_type in company_insights else "other"
    company_info = company_insights[company_type_key]
    role_info = role_insights[role_category]

    # Priority-specific insights
    priority_context = {
        Priority.P0: {
            "urgency": "Immediate Priority",
            "why": "Tier 1 target with highest propensity to buy. Strong product-market fit.",
            "action": "Fast-track outreach with personalized messaging and executive engagement."
        },
        Priority.P1: {
            "urgency": "High Priority",
            "why": "Strong fit with clear use case. Good conversion potential.",
            "action": "Standard multi-touch outreach sequence with value-focused messaging."
        },
        Priority.P2: {
            "urgency": "Medium Priority",
            "why": "Relevant but may require more education and longer sales cycle.",
            "action": "Nurture sequence with educational content and use case examples."
        },
    }

    priority_info = priority_context.get(priority, priority_context[Priority.P2])

    # Generate fun conversation starters
    conversation_starters = _generate_conversation_starters(
        company_name=company_name,
        company_type=company_type_key,
        title=title,
        role_category=role_category
    )

    return {
        "icp_fit": company_info["fit"],
        "priority_level": priority.value,
        "priority_context": priority_info,
        "company_analysis": {
            "company_name": company_name,
            "industry": company_type.replace('_', ' ').title(),
            "why_icp": company_info["why"],
            "pain_points": company_info["pain_points"],
            "hyperverge_solution": company_info["hyperverge_solution"]
        },
        "stakeholder_analysis": {
            "title": title,
            "role_category": role_category.title(),
            "decision_authority": role_info["decision_authority"],
            "why_target": role_info["why"],
            "buying_triggers": role_info["buying_triggers"],
            "messaging_approach": role_info["messaging"],
            "conversation_starters": conversation_starters
        },
        "score_reason": score_reason or "Automated scoring based on industry fit and role relevance",
        "recommended_approach": (
            f"This is a {priority_info['urgency'].lower()} prospect. "
            f"{priority_info['action']} "
            f"Lead with {company_type_key} pain points and {role_category} messaging."
        )
    }


def _generate_conversation_starters(
    company_name: str,
    company_type: str,
    title: str,
    role_category: str
) -> List[Dict[str, str]]:
    """
    Generate fun, personalized conversation starters

    These are human icebreakers to warm up the conversation before diving into business.
    Makes outreach more authentic and builds rapport.
    """
    starters = []

    # 1. Industry trend conversation starter
    industry_trends = {
        "banking": [
            {
                "starter": "💬 \"I've been following the rise of open banking APIs - curious how it's impacting your team's approach to customer verification?\"",
                "why": "Shows industry awareness and opens discussion about modern tech"
            },
            {
                "starter": "💬 \"Real-time payments are exploding - how is your compliance team keeping up with the speed without adding headcount?\"",
                "why": "Acknowledges their pain point while showing empathy"
            },
            {
                "starter": "💬 \"With all the challenger banks disrupting the space, what's your take on balancing speed-to-market vs. compliance rigor?\"",
                "why": "Opens strategic conversation about their challenges"
            }
        ],
        "insurance": [
            {
                "starter": "💬 \"Insurtech is booming! How are you thinking about instant policy issuance while managing fraud risk?\"",
                "why": "Shows industry knowledge and addresses their dual concerns"
            },
            {
                "starter": "💬 \"I read that insurance fraud is at an all-time high - what innovations are you most excited about for fighting it?\"",
                "why": "Demonstrates awareness of their challenges"
            },
            {
                "starter": "💬 \"The shift to digital-first insurance is fascinating - how's your team handling identity verification for fully remote onboarding?\"",
                "why": "Opens conversation about digital transformation"
            }
        ],
        "fintech": [
            {
                "starter": "💬 \"Fintech funding is making a comeback - what's the most exciting thing you're building right now?\"",
                "why": "Shows interest in their work and opens positive dialogue"
            },
            {
                "starter": "💬 \"I love how fintechs are reimagining financial services - what inspired your team to tackle this space?\"",
                "why": "Personal question that shows genuine interest"
            }
        ],
        "financial_services": [
            {
                "starter": "💬 \"Financial services is going through such a transformation - what's the biggest shift you've seen in customer expectations?\"",
                "why": "Opens strategic conversation about market changes"
            }
        ]
    }

    # 2. Role-specific conversation starter
    role_starters = {
        "compliance": [
            {
                "starter": "💬 \"Being a compliance leader must feel like playing whack-a-mole with regulations 😅 - what's keeping you up at night these days?\"",
                "why": "Humor + empathy about their challenging role"
            },
            {
                "starter": "💬 \"I'm always curious - what got you into compliance? Was it the excitement of audits or the thrill of regulatory updates? 😊\"",
                "why": "Lighthearted way to learn their background"
            },
            {
                "starter": "💬 \"Compliance teams are the unsung heroes of financial services - what's your secret to staying ahead of regulations?\"",
                "why": "Recognition + genuine interest in their expertise"
            }
        ],
        "risk": [
            {
                "starter": "💬 \"Risk management feels like predicting the future - do you have a crystal ball, or just really good coffee? ☕\"",
                "why": "Humor makes them more approachable"
            },
            {
                "starter": "💬 \"I'm curious - what's the most creative fraud attack you've seen? (Obviously one you successfully blocked!)\"",
                "why": "Shows interest in their expertise + flattery"
            },
            {
                "starter": "💬 \"Risk officers are basically the guardians of the organization - how do you balance being the 'no person' with enabling growth?\"",
                "why": "Acknowledges their challenging balancing act"
            }
        ],
        "operations": [
            {
                "starter": "💬 \"Operations leaders are the real MVPs - you make everything actually work! What process are you most proud of optimizing?\"",
                "why": "Recognition + invites them to share wins"
            },
            {
                "starter": "💬 \"What's the most satisfying process improvement you've ever made? I love a good efficiency story!\"",
                "why": "Shows shared interest in operational excellence"
            }
        ],
        "finance": [
            {
                "starter": "💬 \"Finance teams always have the best ROI stories - what's your favorite example of a smart investment that paid off?\"",
                "why": "Invites them to share success stories"
            },
            {
                "starter": "💬 \"I'm always curious how finance leaders think about build vs. buy decisions - any frameworks you swear by?\"",
                "why": "Opens strategic conversation about decision-making"
            }
        ],
        "technology": [
            {
                "starter": "💬 \"Tech leaders in financial services have such a unique challenge - innovation vs. regulation. How do you navigate that?\"",
                "why": "Acknowledges their specific challenges"
            },
            {
                "starter": "💬 \"What's the coolest tech you've implemented recently? I love hearing about modern stacks in banking/finance!\"",
                "why": "Shows genuine interest in their technical work"
            }
        ]
    }

    # 3. Personal/human conversation starter
    human_starters = [
        {
            "starter": "💬 \"Chicago in April is beautiful for ELFA! Have you been to the conference before? Any hidden gem restaurants you'd recommend?\"",
            "why": "Conference context + shows you're human and interested in their local knowledge"
        },
        {
            "starter": "💬 \"I saw you're at ELFA - what session are you most excited about? I always find the compliance track fascinating (probably shows my nerd side 🤓)\"",
            "why": "Conference context + self-deprecating humor"
        },
        {
            "starter": "💬 \"How's the ELFA conference treating you? Are you more in 'networking mode' or 'escape to quiet coffee mode'? 😄\"",
            "why": "Relatable conference humor"
        },
        {
            "starter": f"💬 \"I noticed you're at {company_name} - I'd love to hear what drew you to the company. The team seems impressive!\"",
            "why": "Personal interest + flattery about their company choice"
        }
    ]

    # 4. Achievement/milestone conversation starter
    milestone_starters = [
        {
            "starter": f"💬 \"I saw {company_name} in the news recently - exciting times! What's it like being part of this growth phase?\"",
            "why": "Shows you've done research + invites them to share excitement"
        },
        {
            "starter": "💬 \"Your LinkedIn shows an impressive career path! What's been your favorite role so far, and why?\"",
            "why": "Shows you researched them + invites storytelling"
        },
        {
            "starter": "💬 \"I'm always curious about career journeys - how did you end up in this role? Any unexpected turns along the way?\"",
            "why": "Personal question that shows genuine interest"
        }
    ]

    # Select starters based on context
    # Add industry trend starter
    if company_type in industry_trends:
        starters.append(industry_trends[company_type][hash(company_name) % len(industry_trends[company_type])])

    # Add role-specific starter
    if role_category in role_starters:
        starters.append(role_starters[role_category][hash(title) % len(role_starters[role_category])])

    # Add human/conference starter
    starters.append(human_starters[hash(company_name + title) % len(human_starters)])

    # Add milestone starter
    starters.append(milestone_starters[hash(title + company_name) % len(milestone_starters)])

    return starters
