/**
 * AdjustChat.jsx – Chat panel for adjusting a translation.
 *
 * The user types an adjustment instruction (e.g. "make it more formal",
 * "translate 'cat' as 猫 instead of ネコ") and receives an updated translation
 * together with the model's reasoning about the changes made.
 */
import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

export default function AdjustChat({
  documentName,
  onRequestAdjust,
  disabled = false,
}) {
  const [instruction, setInstruction] = useState('');
  const [history, setHistory] = useState([]);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const historyEndRef = useRef(null);

  // Auto-scroll the history list when new messages arrive
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleSend = async () => {
    if (!instruction.trim() || isAdjusting || disabled) return;

    const userInstruction = instruction.trim();
    setInstruction('');
    setIsAdjusting(true);

    setHistory(prev => [...prev, { role: 'user', content: userInstruction }]);

    try {
      const result = await onRequestAdjust(userInstruction);

      setHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: result.translation,
          reasoning: result.reasoning || result.explanation || '',
        },
      ]);
    } catch (err) {
      const detail   = err?.response?.data?.detail || err?.message || 'Unknown error';
      const isOffline =
        detail.toLowerCase().includes('offline') ||
        detail.toLowerCase().includes('reachable') ||
        err?.response?.status === 503;
      const msg = isOffline
        ? '⚠️ Local server offline – make sure LM Studio or Ollama is running.'
        : `❌ ${detail}`;

      setHistory(prev => [...prev, { role: 'error', content: msg }]);
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col bg-slate-900 border-t border-slate-700">
      {/* Message history */}
      {history.length > 0 && (
        <div className="overflow-y-auto max-h-36 px-4 py-2 space-y-2">
          {history.map((msg, idx) => (
            <div key={idx} className="text-xs">
              {msg.role === 'user' && (
                <div className="text-blue-300">
                  <span className="text-slate-500 mr-1">You:</span>
                  {msg.content}
                </div>
              )}
              {msg.role === 'assistant' && (
                <div>
                  {msg.reasoning && (
                    <div className="text-slate-400 italic mb-0.5">
                      ↳ Reasoning: {msg.reasoning}
                    </div>
                  )}
                  <div className="text-green-300 font-mono">{msg.content}</div>
                </div>
              )}
              {msg.role === 'error' && (
                <div className="text-red-400">{msg.content}</div>
              )}
            </div>
          ))}
          <div ref={historyEndRef} />
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2 px-3 py-2 bg-slate-800">
        <input
          type="text"
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isAdjusting || disabled}
          placeholder={
            disabled
              ? 'Translate the document first to enable adjustment…'
              : `Adjust the ${documentName.toLowerCase()} translation… (e.g. "make it more formal")`
          }
          className="flex-1 bg-slate-900 text-slate-100 text-xs border border-slate-600
                     rounded px-3 py-1.5 focus:outline-none focus:border-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed placeholder-slate-600"
        />
        <button
          onClick={handleSend}
          disabled={!instruction.trim() || isAdjusting || disabled}
          className="p-1.5 rounded bg-blue-600 hover:bg-blue-500
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors flex-shrink-0"
          title="Send adjustment"
        >
          {isAdjusting
            ? (
              <span className="inline-block w-4 h-4 border-2 border-white
                               border-t-transparent rounded-full animate-spin" />
            )
            : <Send size={14} />
          }
        </button>
      </div>
    </div>
  );
}
