const MOCK_JOBS = [
  {
    external_id: 'mock-001',
    source: 'mock',
    title: 'Senior Product Manager',
    company: 'Horizon Labs',
    location: 'San Francisco, CA',
    region: 'United States',
    remote_type: 'hybrid',
    description: `We're looking for a Senior Product Manager to lead our core platform team. You will define the roadmap, work closely with engineering and design, and own key OKRs for user engagement and retention.\n\nRequirements:\n• 5+ years of product management experience\n• Track record of shipping 0-to-1 products\n• Strong data fluency (SQL, Mixpanel, or similar)\n• Experience working with distributed engineering teams\n• Excellent written and verbal communication skills\n\nNice to have:\n• SaaS or fintech background\n• Experience with enterprise sales cycles`,
    compensation_min: 155000,
    compensation_max: 195000,
    compensation_currency: 'USD',
    url: 'https://example.com/jobs/mock-001',
    posted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    external_id: 'mock-002',
    source: 'mock',
    title: 'UX Designer — Growth',
    company: 'Driftwood',
    location: 'Remote',
    region: 'Remote',
    remote_type: 'remote',
    description: `Driftwood is a Series B consumer startup hiring a UX Designer to own our growth and activation flows. You'll design onboarding, paywall, and referral experiences that move the needle on conversion.\n\nRequirements:\n• 3–6 years of UX or product design experience\n• Portfolio showing end-to-end design process\n• Experience with Figma and design systems\n• Ability to work cross-functionally with growth and engineering\n\nNice to have:\n• Experience running A/B tests\n• Background in mobile-first design`,
    compensation_min: 120000,
    compensation_max: 150000,
    compensation_currency: 'USD',
    url: 'https://example.com/jobs/mock-002',
    posted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    external_id: 'mock-003',
    source: 'mock',
    title: 'Engineering Manager, Backend',
    company: 'Trellis Systems',
    location: 'Austin, TX',
    region: 'United States',
    remote_type: 'onsite',
    description: `Trellis is hiring an Engineering Manager to lead our 8-person backend team. You'll own delivery, grow engineers, and partner with product on technical strategy.\n\nRequirements:\n• 2+ years managing software engineers\n• Strong backend engineering background (Go, Python, or Node)\n• Experience with distributed systems at scale\n• Excellent communication and stakeholder management skills`,
    compensation_min: 175000,
    compensation_max: 220000,
    compensation_currency: 'USD',
    url: 'https://example.com/jobs/mock-003',
    posted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    external_id: 'mock-004',
    source: 'mock',
    title: 'Growth Marketing Manager',
    company: 'Marble',
    location: 'New York, NY',
    region: 'United States',
    remote_type: 'hybrid',
    description: `Marble is a fast-growing fintech startup looking for a Growth Marketing Manager to own our paid acquisition and lifecycle channels.\n\nRequirements:\n• 4+ years of performance or growth marketing experience\n• Deep familiarity with paid search and social (Meta, Google)\n• Experience with marketing automation (HubSpot, Klaviyo, or similar)\n• Data-driven mindset — you know your CAC and LTV cold`,
    compensation_min: 110000,
    compensation_max: 140000,
    compensation_currency: 'USD',
    url: 'https://example.com/jobs/mock-004',
    posted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    external_id: 'mock-005',
    source: 'mock',
    title: 'Senior Software Engineer, Full Stack',
    company: 'Coastline AI',
    location: 'Remote — US',
    region: 'United States',
    remote_type: 'remote',
    description: `We're building AI-powered tools for logistics teams. You'll work across the stack on features users rely on every day.\n\nRequirements:\n• 5+ years of software engineering experience\n• Strong proficiency in React and Node.js or Python\n• Experience with PostgreSQL and REST or GraphQL APIs\n• Comfort with cloud infrastructure (AWS or GCP)\n• Collaborative, low-ego approach to code review`,
    compensation_min: 160000,
    compensation_max: 200000,
    compensation_currency: 'USD',
    url: 'https://example.com/jobs/mock-005',
    posted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    external_id: 'mock-006',
    source: 'mock',
    title: 'Operations Lead',
    company: 'Fieldline',
    location: 'Chicago, IL',
    region: 'United States',
    remote_type: 'hybrid',
    description: `Fieldline is scaling fast and we need an Operations Lead to own our vendor relationships, fulfillment processes, and internal tooling.\n\nRequirements:\n• 3–5 years of operations, supply chain, or COO-adjacent experience\n• Strong project management skills\n• Comfort with ambiguity and ability to build processes from scratch\n• Experience working cross-functionally in a startup environment`,
    compensation_min: 95000,
    compensation_max: 125000,
    compensation_currency: 'USD',
    url: 'https://example.com/jobs/mock-006',
    posted_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    external_id: 'mock-007',
    source: 'mock',
    title: 'Data Analyst',
    company: 'Pinwheel Health',
    location: 'Remote',
    region: 'Remote',
    remote_type: 'remote',
    description: `Pinwheel Health is hiring a Data Analyst to support our clinical operations and product teams with insights that improve patient outcomes.\n\nRequirements:\n• 2–4 years of data analysis experience\n• Strong SQL skills and experience with BI tools (Looker, Metabase, or Tableau)\n• Ability to translate data into clear, actionable narratives for non-technical stakeholders\n• Healthcare or health-adjacent experience a plus`,
    compensation_min: 85000,
    compensation_max: 115000,
    compensation_currency: 'USD',
    url: 'https://example.com/jobs/mock-007',
    posted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    external_id: 'mock-008',
    source: 'mock',
    title: 'Head of Content',
    company: 'Archway',
    location: 'Remote — anywhere',
    region: 'Remote',
    remote_type: 'remote',
    description: `Archway is a media company for the next generation of builders. We need a Head of Content to own our editorial strategy, manage a team of writers, and grow our audience.\n\nRequirements:\n• 5+ years of content or editorial experience, including management\n• Track record of building audience through organic content\n• Sharp editorial instincts and strong writing ability\n• Experience with SEO and content analytics`,
    compensation_min: 130000,
    compensation_max: 165000,
    compensation_currency: 'USD',
    url: 'https://example.com/jobs/mock-008',
    posted_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

class MockAdapter {
  async search({ keywords = [], regions = [], page = 1, limit = 20 }) {
    let results = [...MOCK_JOBS];

    if (keywords.length) {
      const kw = keywords.map(k => k.toLowerCase());
      results = results.filter(j =>
        kw.some(k =>
          j.title.toLowerCase().includes(k) ||
          j.description.toLowerCase().includes(k) ||
          j.company.toLowerCase().includes(k),
        ),
      );
    }

    if (regions.length) {
      const hasRemote = regions.some(r => r.toLowerCase().includes('remote'));
      const regionLower = regions.map(r => r.toLowerCase());
      results = results.filter(j =>
        (hasRemote && j.remote_type === 'remote') ||
        regionLower.some(r => (j.region || '').toLowerCase().includes(r)) ||
        regionLower.some(r => (j.location || '').toLowerCase().includes(r)),
      );
    }

    const start = (page - 1) * limit;
    const paged = results.slice(start, start + limit);

    return { jobs: paged, total: results.length, page, limit };
  }
}

module.exports = MockAdapter;
