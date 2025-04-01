import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./App.css";
import { ArrowUp, SplitSquareVertical, RefreshCw, Trash2 } from "lucide-react";

function placeCaretAtEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function App() {
  const [file, setFile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);
  const [englishBlocks, setEnglishBlocks] = useState([]);
  const [japaneseBlocks, setJapaneseBlocks] = useState([]);
  const [skipWords, setSkipWords] = useState("");
  const [useSkipWords, setUseSkipWords] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);

  const originalRef = useRef(null);
  const translatedRef = useRef(null);

  const englishRefs = useRef({});
  const japaneseRefs = useRef({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("savedTranslation");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.japanese)) {
          setJapaneseBlocks(parsed.japanese);
          setEnglishBlocks(parsed.english || []);
          setEditing(true);
        }
      }
    } catch (err) {
      console.warn("Invalid localStorage data — cleared.");
      localStorage.removeItem("savedTranslation");
    }
  }, []);

  useEffect(() => {
    if (japaneseBlocks.length > 0 || englishBlocks.length > 0) {
      const payload = {
        english: englishBlocks,
        japanese: japaneseBlocks,
      };
      localStorage.setItem("savedTranslation", JSON.stringify(payload));
    }
  }, [englishBlocks, japaneseBlocks]);

  useEffect(() => {
    if (originalRef.current && activeIndex !== null) {
      const el = originalRef.current.querySelector(`[data-index='${activeIndex}']`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_prompt", useCustomPrompt ? customPrompt : "");

    setIsTranslating(true);

    try {
      const response = await axios.post("https://translation-editor-backend.onrender.com/upload/", formData);
      const original = response.data.pairs.map((pair) => pair.original);
      const translated = response.data.pairs.map((pair) => pair.translated);
      setEnglishBlocks(original);
      setJapaneseBlocks(translated);
      setEditing(true);
    } catch (err) {
      console.error("Translation error:", err);
      alert("Translation failed: " + (err.response?.data?.detail || err.message));
    }

    setIsTranslating(false);
  };

  const retranslateBlock = async (index) => {
    const sentence = englishBlocks[index];
    if (!sentence) return;

    try {
      const response = await axios.post("https://translation-editor-backend.onrender.com/retranslate/", {
        sentences: [sentence],
        user_prompt: useCustomPrompt ? customPrompt : "",
      });

      const translated = response.data.pairs[0]?.translated || "";
      const updated = [...japaneseBlocks];
      updated[index] = translated;
      setJapaneseBlocks(updated);

      setTimeout(() => {
        const node = document.querySelector(`.japanese-column [data-index="${index}"]`);
        if (node) placeCaretAtEnd(node);
      }, 0);
    } catch (err) {
      console.error("Re-translation error:", err);
      alert("Re-translation failed: " + JSON.stringify(err.response?.data || err.message));
    }
  };

  const handleBlur = (index, isEnglish) => {
    const refMap = isEnglish ? englishRefs.current : japaneseRefs.current;
    const newText = refMap[index]?.innerText || "";

    const blocks = isEnglish ? englishBlocks : japaneseBlocks;
    if (blocks[index] === newText) return;

    const updated = [...blocks];
    updated[index] = newText;

    isEnglish ? setEnglishBlocks(updated) : setJapaneseBlocks(updated);
  };

  const handleCaretChange = (e) => {
    let target = e.target;
    while (target && target.dataset?.index === undefined) {
      target = target.parentNode;
    }
    if (target && target.dataset.index !== undefined) {
      setActiveIndex(Number(target.dataset.index));
    }
  };

  const mergeBlock = (index, isEnglish) => {
    const en = [...englishBlocks];
    const jp = [...japaneseBlocks];

    if (index < en.length - 1) {
      if (isEnglish) {
        en[index] += " " + en[index + 1];
        en.splice(index + 1, 1);
        jp.splice(index + 1, 1);
        setEnglishBlocks(en);
        setJapaneseBlocks(jp);
      } else {
        jp[index] += " " + jp[index + 1];
        jp.splice(index + 1, 1);
        setJapaneseBlocks(jp);
      }
    }
  };

  const splitBlock = (index, isEnglish) => {
    const blocks = isEnglish ? [...englishBlocks] : [...japaneseBlocks];
    const sentence = blocks[index];
    const parts = sentence.match(/[^。！？.?!]+[。！？.?!]?/g)?.map((s) => s.trim()) || [];
    if (parts.length > 1) {
      blocks.splice(index, 1, ...parts);
      isEnglish ? setEnglishBlocks(blocks) : setJapaneseBlocks(blocks);
    }
  };

  const deleteBlock = (index, isEnglish) => {
    const blocks = isEnglish ? [...englishBlocks] : [...japaneseBlocks];
    blocks.splice(index, 1);
    isEnglish ? setEnglishBlocks(blocks) : setJapaneseBlocks(blocks);
  };

  const handleExport = () => {
    const content = japaneseBlocks.join("\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "translated_text.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLocalSave = () => {
    if (!window.confirm("Are you sure you want to clear all saved translations?")) return;
    localStorage.removeItem("savedTranslation");
    setJapaneseBlocks([]);
    setEnglishBlocks([]);
    setEditing(false);
  };

  const renderEditorBlock = (blocks, isEnglish) => {
    const refMap = isEnglish ? englishRefs.current : japaneseRefs.current;

    return blocks.map((s, i) => (
      <div key={`${isEnglish ? "eng" : "jp"}-${i}`} className={`block ${i === activeIndex ? "highlighted" : ""}`} data-index={i}>
        <div
          ref={(el) => {
            if (el) refMap[i] = el;
          }}
          contentEditable
          suppressContentEditableWarning
          onClick={handleCaretChange}
          onKeyUp={handleCaretChange}
          onInput={() => {}}
          onBlur={() => handleBlur(i, isEnglish)}
          className="editable"
          data-index={i}
        >
          {s}
        </div>

        {activeIndex === i && (
          <div className="btn-group">
            <button onClick={() => splitBlock(i, isEnglish)} className="btn-split">
              <SplitSquareVertical size={14} />
            </button>
            {i < blocks.length - 1 && (
              <button onClick={() => mergeBlock(i, isEnglish)} className="btn-merge">
                <ArrowUp size={14} />
              </button>
            )}
            {isEnglish && (
              <button onClick={() => retranslateBlock(i)} className="btn-retranslate">
                <RefreshCw size={14} />
              </button>
            )}
            {!isEnglish && (
              <button onClick={() => deleteBlock(i, isEnglish)} className="btn-delete">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="container">
      <div className="header">
        <img src="/logo.png" alt="Logo" className="logo" />
        <h1 className="title">Translation Editor</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <div className="form-group">
          <input type="file" onChange={handleFileChange} accept=".pdf" />

          <label className="form-check">
            <input
              type="checkbox"
              checked={useSkipWords}
              onChange={(e) => setUseSkipWords(e.target.checked)}
            />
            Skip Words
          </label>

          {useSkipWords && (
            <textarea
              rows="4"
              value={skipWords}
              onChange={(e) => setSkipWords(e.target.value)}
              placeholder="Enter words or phrases to skip, one per line"
            />
          )}

          <label className="form-check">
            <input
              type="checkbox"
              checked={useCustomPrompt}
              onChange={(e) => setUseCustomPrompt(e.target.checked)}
            />
            Custom Prompt
          </label>

          {useCustomPrompt && (
            <textarea
              rows="3"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Enter custom translation prompt"
            />
          )}
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: 16 }}>
          Translate
        </button>

        {editing && (
          <>
            <button type="button" onClick={handleExport} className="btn-primary">
              Export Translation
            </button>
            <button type="button" onClick={clearLocalSave} className="btn-tertiary">
              Clear Local Save
            </button>
          </>
        )}
      </form>

      {isTranslating && <p>🔄 Translating...</p>}

      {editing && (
        <div className="editor-wrapper">
          <div className="column-wrapper">
            <h2>English</h2>
            <div className="column english-column" ref={originalRef}>
              {renderEditorBlock(englishBlocks, true)}
            </div>
          </div>

          <div className="column-wrapper">
            <h2>Japanese</h2>
            <div className="column japanese-column" ref={translatedRef}>
              {renderEditorBlock(japaneseBlocks, false)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
