import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

const JOURNEY = [
  {
    step: '01',
    label: 'Know what fits',
    heading: 'Discover roles built for your background.',
    body: "Upload your resume and Dream Job Ready tells you exactly what roles you are positioned for — with the specific reason why, and where to find open listings. No guessing. No spray and pray.",
  },
  {
    step: '02',
    label: 'Get your honest score',
    heading: 'The truth before you send anything.',
    body: "Every job you bring in gets scored across four categories: skills match, experience depth, culture fit, and trajectory. You see where you are strong, where you are stretched, and a recruiter's plain verdict.",
  },
  {
    step: '03',
    label: 'Tailor your materials',
    heading: 'A resume and cover letter built for this role.',
    body: "Your resume is rewritten using the job's language where your real experience maps to it. Your cover letter opens with something specific, not a template. Nothing invented — everything sharpened.",
  },
  {
    step: '04',
    label: 'Walk in ready',
    heading: 'Every question they might ask. Every watch-out.',
    body: "Tell us who is interviewing you and their role, and the AI researches their public background to sharpen your prep. Don't know yet? It researches the company and role instead. Either way you get behavioral and technical questions, coaching calibrated to your background, and a watch-out list of what your resume will make them probe.",
  },
  {
    step: '05',
    label: 'Debrief and keep moving',
    heading: 'How did it actually go?',
    body: "Drop in your interview notes and get a plain read: what likely landed, what could be stronger, and exactly what to do in the next 24 hours. Then move to the next one.",
  },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-linen">
      {/* Nav */}
      <header className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <span className="font-montserrat font-bold text-teal tracking-widest text-sm uppercase">Dream Job Ready</span>
        <div className="flex items-center gap-3">
          {user ? (
            <Link to="/dashboard">
              <Button size="sm">Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button size="sm">Get started free</Button>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
        <p className="font-montserrat text-xs uppercase tracking-widest text-copper mb-6">Your entire job search in one place</p>
        <h1 className="font-montserrat font-bold text-4xl sm:text-5xl md:text-6xl text-teal-deeper leading-tight mb-6">
          From your resume<br />
          <span className="text-teal">to your first step through the door.</span>
        </h1>
        <p className="font-lora text-lg text-ink/70 max-w-2xl mx-auto mb-10 leading-relaxed">
          Dream Job Ready walks with you through every stage of the job search — discovering what fits your background, tailoring your materials, preparing you to interview, and helping you reflect on what happened after. Built on what you have actually done, not what sounds good.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/auth?mode=signup">
            <Button size="lg">Start for free</Button>
          </Link>
          <Link to="/auth">
            <Button variant="outline" size="lg">Sign in</Button>
          </Link>
        </div>
        <p className="mt-5 font-lora text-xs text-ink/40">No credit card. No job board. Just preparation that holds up.</p>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="rule-teal" />
      </div>

      {/* Journey steps */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <p className="font-montserrat text-xs uppercase tracking-widest text-copper text-center mb-4">The full arc</p>
        <h2 className="font-montserrat font-bold text-2xl sm:text-3xl text-teal-deeper text-center mb-14">
          Stretch. Prepare. Apply. Reflect.
        </h2>
        <div className="flex flex-col gap-10">
          {JOURNEY.map((j, i) => (
            <div key={j.step} className={`flex flex-col sm:flex-row gap-6 sm:gap-10 items-start ${i % 2 !== 0 ? 'sm:flex-row-reverse' : ''}`}>
              <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full border-2 border-teal/20 bg-teal/5">
                <span className="font-montserrat font-bold text-sm text-teal">{j.step}</span>
              </div>
              <div className="flex-1 flex flex-col gap-2 pb-10 border-b border-[#e5e5e0] sm:border-0">
                <span className="font-montserrat text-xs uppercase tracking-widest text-copper">{j.label}</span>
                <h3 className="font-montserrat font-bold text-lg text-teal-deeper">{j.heading}</h3>
                <p className="font-lora text-sm text-ink/70 leading-relaxed max-w-xl">{j.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="rule-teal" />
      </div>

      {/* Bring your own job */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="font-montserrat text-xs uppercase tracking-widest text-copper mb-6">Bring any job posting</p>
        <h2 className="font-montserrat font-bold text-2xl sm:text-3xl text-teal-deeper mb-6">
          Found something you want to go after?
        </h2>
        <p className="font-lora text-base text-ink/70 leading-relaxed max-w-2xl mx-auto">
          Paste the job description or upload a screenshot of any posting you find. Dream Job Ready scores your fit, tailors your resume, and gets you ready to pursue it — all in one flow.
        </p>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="rule-teal" />
      </div>

      {/* Ground rules */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="font-montserrat text-xs uppercase tracking-widest text-copper mb-6">How we work</p>
        <h2 className="font-montserrat font-bold text-2xl sm:text-3xl text-teal-deeper mb-6">
          Your resume is the source of truth.
        </h2>
        <p className="font-lora text-base text-ink/70 leading-relaxed max-w-2xl mx-auto">
          Dream Job Ready never invents a skill, title, metric, or outcome you have not documented. If a role requires something you do not have, the AI says so plainly and helps you decide what to do with that information. This is not a resume inflation machine. It is a preparation machine.
        </p>
      </section>

      {/* CTA */}
      <section className="bg-teal-deeper py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-montserrat font-bold text-2xl sm:text-3xl text-linen mb-4">
            Ready to stretch toward your next role?
          </h2>
          <p className="font-lora text-linen/70 mb-8 leading-relaxed">
            Upload your resume, see what fits your background, and let Dream Job Ready walk with you through every step from there.
          </p>
          <Link to="/auth?mode=signup">
            <Button variant="outline" size="lg" className="border-linen text-linen hover:bg-linen hover:text-teal-deeper">
              Get started free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between border-t border-[#e5e5e0]">
        <span className="font-montserrat font-bold text-teal text-xs tracking-widest uppercase">Dream Job Ready</span>
        <span className="font-lora text-xs text-ink/40">&copy; {new Date().getFullYear()} Dream Job Ready</span>
      </footer>
    </div>
  );
}
