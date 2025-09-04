import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Database, User, Check, AlertCircle, ArrowLeft } from 'lucide-react';
import { apiService } from '../services/api';

const Confidence = ({ v }) => {
  if (v === undefined || v === null) return null;
  const pct = Math.round((v || 0) * 100);
  const color = v >= 0.9 ? 'bg-green-500' : v >= 0.7 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
      <span className="text-xs text-gray-500">{pct}%</span>
    </div>
  );
};

export default function DocumentDetailV2() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [hilEdits, setHilEdits] = useState({});
  const [hilNotes, setHilNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [childKey, setChildKey] = useState('');

  const setField = (field, updater) => setHilEdits(prev => ({ ...prev, [field]: typeof updater === 'function' ? updater(prev[field]) : updater }));

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const report = await apiService.getDocumentReport(id);
      const d = report.data;
      setDoc(d);
      // init edits
      if (d?.latest_extraction) {
        const init = {};
        Object.entries(d.latest_extraction)
          .filter(([k]) => !k.startsWith('_'))
          .forEach(([k, fd]) => (init[k] = fd?.value));
        setHilEdits(init);
        // detect child array-of-objects
        const arrKeys = Object.entries(d.latest_extraction)
          .filter(([k]) => !k.startsWith('_'))
          .filter(([_, fd]) => Array.isArray(fd?.value) && fd.value.every(r => r && typeof r === 'object' && !Array.isArray(r)))
          .map(([k, fd]) => ({ k, len: fd?.value?.length || 0 }));
        if (arrKeys.length) setChildKey(arrKeys.sort((a,b)=>b.len-a.len)[0].k);
      }
    } catch (e) {
      setError('Failed to load document');
    } finally { setLoading(false); }
  };

  const save = async () => {
    if (!doc?.latest_extraction) return;
    setSaving(true);
    try {
      const corrections = {};
      for (const [k, v] of Object.entries(hilEdits || {})) corrections[k] = v;
      await apiService.updateHilCorrections(id, { corrections, reviewer: 'user', notes: hilNotes || '' });
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save corrections');
    } finally { setSaving(false); }
  };

  const submit = async (decision) => {
    setSubmitting(true);
    try {
      if (Object.keys(hilEdits || {}).length) await save();
      await apiService.submitHilReview(id, {
        document_id: id,
        decision: decision === 'approve' ? 'APPROVED' : 'REJECTED',
        field_reviews: [],
        overall_comments: hilNotes || ''
      });
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="p-10 text-center text-gray-600">Loading…</div>;
  if (error) return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center text-red-600 mb-2"><AlertCircle className="h-5 w-5 mr-2"/>Error</div>
      <div className="text-gray-700">{error}</div>
    </div>
  );
  if (!doc) return null;

  const entries = Object.entries(doc.latest_extraction || {}).filter(([k]) => !k.startsWith('_'));
  const ck = childKey || entries.find(([_, fd]) => Array.isArray(fd?.value) && fd.value.every((r) => r && typeof r === 'object' && !Array.isArray(r)))?.[0] || '';
  const parentEntries = entries.filter(([k]) => k !== ck);
  const childField = ck ? doc.latest_extraction[ck] : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button onClick={() => window.history.back()} className="flex items-center text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4 mr-1"/> Back
      </button>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">Document #{doc.id}</div>
            <div className="text-sm text-gray-500">{doc.filename} • {doc.mime_type}</div>
          </div>
          <span className="px-2 py-1 text-xs rounded-full border bg-gray-50">{doc.state}</span>
        </div>

        <div className="space-y-4">
          {/* Parent/Header fields editable */}
          {parentEntries.map(([fieldName, fieldData]) => {
            const val = hilEdits[fieldName];
            const isArray = Array.isArray(val);
            const isArrayOfObjects = isArray && val.every((r) => r && typeof r === 'object' && !Array.isArray(r));
            const typeHint = (fieldData?.type_hint || '').toLowerCase();
            const inputType = typeHint.includes('date') ? 'date' : (typeHint.includes('number') || typeof fieldData?.value === 'number') ? 'number' : 'text';
            const columns = isArrayOfObjects ? Array.from(new Set((val || []).flatMap(r => Object.keys(r||{})))) : [];

            return (
              <div key={fieldName} className="border border-gray-200 dark:border-slate-600 rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-gray-900 dark:text-white">{fieldName}</div>
                    {Array.isArray(fieldData?.value) && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border">{(val||[]).length} items</span>
                    )}
                  </div>
                  {fieldData.confidence !== undefined && <Confidence v={fieldData.confidence} />}
                </div>

                {isArrayOfObjects ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border border-gray-200 rounded">
                      <thead className="bg-gray-50">
                        <tr>{columns.map(c => <th key={c} className="px-3 py-2 text-left border-b">{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {(val||[]).map((row, rIdx) => (
                          <tr key={rIdx} className="odd:bg-white even:bg-gray-50">
                            {columns.map(c => (
                              <td key={c} className="px-3 py-1 border-b">
                                <input className="w-full px-2 py-1 border rounded" value={row?.[c] ?? ''} onChange={(e)=> setField(fieldName, (prev)=>{ const next = Array.isArray(prev)?[...prev]:[]; const nr = { ...(next[rIdx]||{}) }; nr[c]=e.target.value; next[rIdx]=nr; return next; })} />
                              </td>
                            ))}
                            <td className="px-2 py-1 border-b text-center">
                              <button className="text-red-600 text-xs" onClick={()=> setField(fieldName, (prev)=>(prev||[]).filter((_,i)=>i!==rIdx))}>Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button className="mt-2 text-sm px-3 py-1 rounded bg-gray-100 border" onClick={()=> setField(fieldName, [ ...(hilEdits[fieldName]||[]), {} ])}>Add Row</button>
                  </div>
                ) : Array.isArray(val) ? (
                  <div>
                    {(val||[]).map((item,i)=>(
                      <div key={i} className="flex items-center gap-2 mb-2">
                        <input className="flex-1 px-2 py-1 border rounded" value={String(item??'')} onChange={(e)=> setField(fieldName, (prev)=>{ const next=Array.isArray(prev)?[...prev]:[]; next[i]=e.target.value; return next; })} />
                        <button className="text-red-600 text-xs" onClick={()=> setField(fieldName, (prev)=>(prev||[]).filter((_,idx)=>idx!==i))}>Remove</button>
                      </div>
                    ))}
                    <button className="text-sm px-3 py-1 rounded bg-gray-100 border" onClick={()=> setField(fieldName, [ ...(val||[]), '' ])}>Add Item</button>
                  </div>
                ) : typeof val === 'object' && val !== null ? (
                  <textarea className="w-full px-3 py-2 border rounded text-xs" rows={4} value={JSON.stringify(val,null,2)} onChange={(e)=>{ try { setField(fieldName, JSON.parse(e.target.value)); } catch { /* ignore invalid JSON typing */ } }} />
                ) : (
                  <input className="w-full px-3 py-2 border rounded" type={inputType} value={val ?? ''} onChange={(e)=> setField(fieldName, inputType==='number'? (e.target.value===''? '' : Number(e.target.value)) : e.target.value)} />
                )}

                {fieldData.type_hint && <div className="mt-1 text-xs text-gray-500">Type: {fieldData.type_hint}</div>}
              </div>
            );
          })}

          {/* Child/Line Items */}
          {childField && Array.isArray(hilEdits[ck]) && hilEdits[ck].every(r=> r && typeof r==='object' && !Array.isArray(r)) && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-gray-900 dark:text-white">{ck}</div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border">{(hilEdits[ck]||[]).length} items</span>
                </div>
                {childField.confidence !== undefined && <Confidence v={childField.confidence} />}
              </div>
              {(() => {
                const columns = Array.from(new Set((hilEdits[ck]||[]).flatMap(r=> Object.keys(r||{}))));
                return (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border border-gray-200 rounded">
                      <thead className="bg-gray-50">
                        <tr>
                          {columns.map(c => <th key={c} className="px-3 py-2 text-left border-b">{c}</th>)}
                          <th className="w-12 border-b" />
                        </tr>
                      </thead>
                      <tbody>
                        {(hilEdits[ck]||[]).map((row,rIdx)=> (
                          <tr key={rIdx} className="odd:bg-white even:bg-gray-50">
                            {columns.map(c => (
                              <td key={c} className="px-3 py-1 border-b">
                                <input className="w-full px-2 py-1 border rounded" value={row?.[c] ?? ''} onChange={(e)=> setHilEdits(prev=>{ const rows=Array.isArray(prev[ck])?[...prev[ck]]:[]; const nr={...(rows[rIdx]||{})}; nr[c]=e.target.value; rows[rIdx]=nr; return { ...prev, [ck]: rows }; })} />
                              </td>
                            ))}
                            <td className="px-2 py-1 border-b text-center">
                              <button className="text-red-600 text-xs" onClick={()=> setHilEdits(prev=> ({ ...prev, [ck]: (prev[ck]||[]).filter((_,i)=>i!==rIdx) }))}>Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button className="mt-2 text-sm px-3 py-1 rounded bg-gray-100 border" onClick={()=> setHilEdits(prev=> ({ ...prev, [ck]: [ ...(prev[ck]||[]), {} ] }))}>Add Row</button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Save / Approve / Reject */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 p-6">
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Reviewer Notes</label>
          <textarea className="w-full px-3 py-2 border rounded text-sm" rows={3} value={hilNotes} onChange={(e)=> setHilNotes(e.target.value)} placeholder="Optional" />
        </div>
        <div className="flex items-center justify-between">
          <button className="px-6 py-2 bg-blue-600 text-white rounded" disabled={saving} onClick={save}>{saving? 'Saving…' : 'Save Corrections'}</button>
          <div className="flex items-center gap-3">
            <button className="px-6 py-2 bg-red-600 text-white rounded" disabled={submitting} onClick={()=> submit('reject')}>{submitting? 'Submitting…' : 'Reject'}</button>
            <button className="px-6 py-2 bg-green-600 text-white rounded" disabled={submitting} onClick={()=> submit('approve')}>{submitting? 'Submitting…' : 'Approve'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
