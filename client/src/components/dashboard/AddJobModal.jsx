import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { api } from '../../lib/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

export default function AddJobModal({ open, onClose, onAdded }) {
  const [inputMode, setMode]    = useState('text'); // 'text' | 'url' | 'file'
  const [text, setText]         = useState('');
  const [url, setUrl]           = useState('');
  const [title, setTitle]       = useState('');
  const [company, setCompany]   = useState('');
  const [location, setLocation] = useState('');
  const [file, setFile]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const onDrop = useCallback(accepted => { if (accepted[0]) setFile(accepted[0]); }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
  });

  function reset() {
    setText(''); setUrl(''); setTitle(''); setCompany('');
    setLocation(''); setFile(null); setError('');
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('Job title is required.'); return; }
    if (!company.trim()) { setError('Company name is required.'); return; }

    setLoading(true);
    setError('');

    try {
      if (inputMode === 'file' && file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('title', title);
        fd.append('company', company);
        fd.append('location', location);
        await api.jobs.add(fd);
      } else if (text.trim()) {
        await api.jobs.addText({ text, title, company, location });
      } else if (inputMode === 'file' && !file) {
        setError('Please select a file to upload.');
        setLoading(false);
        return;
      } else {
        setError('Please paste the job posting text or upload a screenshot.');
        setLoading(false);
        return;
      }

      reset();
      onAdded?.();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a job you found">
      <div className="flex flex-col gap-5">
        <p className="font-lora text-sm text-ink/60">
          Paste the posting text or upload a screenshot. It gets scored and treated exactly like a discovered listing.
        </p>

        {/* Mode tabs */}
        <div className="flex gap-2">
          {[['text', 'Paste text'], ['file', 'Upload screenshot / PDF']].map(([m, l]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-xs font-montserrat font-semibold rounded-sm border transition-colors ${inputMode === m ? 'border-teal bg-teal/5 text-teal' : 'border-[#e5e5e0] text-ink/50 hover:border-teal/30'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Content input */}
        {inputMode === 'text' && (
          <textarea
            className="w-full h-40 px-3 py-2.5 bg-white border border-[#e5e5e0] rounded-sm font-lora text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:ring-1 focus:ring-teal resize-y"
            placeholder="Paste the full job posting here..."
            value={text}
            onChange={e => setText(e.target.value)}
          />
        )}

        {inputMode === 'url' && (
          <Input
            placeholder="https://jobs.company.com/..."
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        )}

        {inputMode === 'file' && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-sm px-6 py-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-teal bg-teal/5' : file ? 'border-teal/40 bg-teal/5' : 'border-[#e5e5e0] hover:border-teal/40'}`}
          >
            <input {...getInputProps()} />
            {file ? (
              <p className="font-lora text-sm text-teal">{file.name}</p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <ArrowUpTrayIcon className="w-6 h-6 text-ink/30" />
                <p className="font-lora text-sm text-ink/60">PDF or image screenshot</p>
              </div>
            )}
          </div>
        )}

        {/* Job meta */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Job title *" placeholder="e.g. Senior Product Manager" value={title} onChange={e => setTitle(e.target.value)} />
          <Input label="Company *" placeholder="e.g. Acme Corp" value={company} onChange={e => setCompany(e.target.value)} />
        </div>
        <Input label="Location" placeholder="e.g. Remote or San Francisco, CA" value={location} onChange={e => setLocation(e.target.value)} />

        {error && <p className="font-lora text-sm text-red-600">{error}</p>}

        <Button onClick={handleSubmit} loading={loading}>
          Add to Interested
        </Button>
      </div>
    </Modal>
  );
}
