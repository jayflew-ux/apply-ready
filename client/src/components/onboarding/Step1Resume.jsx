import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ArrowUpTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { api } from '../../lib/api';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

const SITUATIONS = [
  { value: 'entry-level',        label: 'Entry-level / first job' },
  { value: 'lateral',            label: 'Lateral move' },
  { value: 'stretch',            label: 'Stretch / step up' },
  { value: 'career-switch',      label: 'Career switch' },
  { value: 'returning',          label: 'Returning after a break' },
  { value: 'relocating',         label: 'Relocating' },
  { value: 'employed-exploring', label: 'Currently employed, exploring' },
  { value: 'laid-off',           label: 'Recently laid off' },
  { value: 'contract-perm',      label: 'Contract-to-perm seeking' },
  { value: 'semi-retired',       label: 'Semi-retired / encore career' },
  { value: 'other',              label: 'Other' },
];

export default function Step1Resume({ onComplete }) {
  const [file, setFile]           = useState(null);
  const [pastedText, setPasted]   = useState('');
  const [mode, setMode]           = useState('upload'); // 'upload' | 'paste'
  const [situation, setSituation] = useState('');
  const [situationOther, setOther] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');

  const onDrop = useCallback(accepted => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
  });

  async function handleContinue() {
    if (!situation) { setError('Please select your situation.'); return; }
    setError('');
    setUploading(true);

    try {
      if (mode === 'upload' && file) {
        const fd = new FormData();
        fd.append('resume', file);
        await api.resume.upload(fd);
      } else if (mode === 'paste' && pastedText.trim()) {
        await api.resume.text(pastedText.trim());
      } else {
        setError('Please upload your resume or paste it.');
        setUploading(false);
        return;
      }

      await api.profile.update({
        situation,
        situation_other: situationOther,
      });

      onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Resume input */}
      <div>
        <div className="flex gap-3 mb-5">
          <button
            onClick={() => setMode('upload')}
            className={`px-4 py-1.5 text-sm font-montserrat font-semibold rounded-sm border transition-colors ${mode === 'upload' ? 'border-teal bg-teal/5 text-teal' : 'border-[#e3ddd2] text-ink/60 hover:border-teal/30'}`}
          >
            Upload file
          </button>
          <button
            onClick={() => setMode('paste')}
            className={`px-4 py-1.5 text-sm font-montserrat font-semibold rounded-sm border transition-colors ${mode === 'paste' ? 'border-teal bg-teal/5 text-teal' : 'border-[#e3ddd2] text-ink/60 hover:border-teal/30'}`}
          >
            Paste text
          </button>
        </div>

        {mode === 'upload' ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-sm px-8 py-12 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-teal bg-teal/5' : file ? 'border-teal/40 bg-teal/5' : 'border-[#e3ddd2] hover:border-teal/40'
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <DocumentTextIcon className="w-8 h-8 text-teal" />
                <p className="font-lora text-sm text-teal font-medium">{file.name}</p>
                <p className="font-lora text-xs text-ink/50">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <ArrowUpTrayIcon className="w-8 h-8 text-ink/30" />
                <p className="font-lora text-sm text-ink/60">
                  {isDragActive ? 'Drop it here' : 'Drop your resume here, or click to select'}
                </p>
                <p className="font-lora text-xs text-ink/40">PDF or DOCX, up to 10 MB</p>
              </div>
            )}
          </div>
        ) : (
          <textarea
            className="w-full h-48 px-4 py-3 surface border border-[#e3ddd2] rounded-sm font-lora text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal resize-y"
            placeholder="Paste your full resume text here..."
            value={pastedText}
            onChange={e => setPasted(e.target.value)}
          />
        )}
      </div>

      {/* Situation */}
      <div>
        <p className="font-montserrat font-semibold text-sm text-ink/80 mb-3 tracking-wide">Which best describes your situation?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SITUATIONS.map(s => (
            <label
              key={s.value}
              className={`flex items-center gap-2 px-3 py-2.5 border rounded-sm cursor-pointer text-sm font-lora transition-colors ${situation === s.value ? 'border-teal bg-teal/5 text-teal' : 'border-[#e3ddd2] text-ink/70 hover:border-teal/30'}`}
            >
              <input
                type="radio"
                name="situation"
                value={s.value}
                checked={situation === s.value}
                onChange={() => setSituation(s.value)}
                className="sr-only"
              />
              <span className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 ${situation === s.value ? 'border-teal bg-teal' : 'border-ink/30'}`} />
              {s.label}
            </label>
          ))}
        </div>
        {situation === 'other' && (
          <input
            type="text"
            className="mt-3 w-full px-3 py-2.5 surface border border-[#e3ddd2] rounded-sm font-lora text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal"
            placeholder="Describe your situation..."
            value={situationOther}
            onChange={e => setOther(e.target.value)}
          />
        )}
      </div>

      {error && <p className="font-lora text-sm text-red-600">{error}</p>}

      <Button onClick={handleContinue} loading={uploading} disabled={uploading}>
        Continue
      </Button>
    </div>
  );
}
