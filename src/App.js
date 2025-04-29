// NOTE: This is your updated App.js with manual linking and page range selection

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
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(9999);
  const [selectedForLinking, setSelectedForLinking] = useState(null);
  const [linkedPairs, setLinkedPairs] = useState({});

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
      const payload = { english: englishBlocks, japanese: japaneseBlocks };
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
    if (useCustomPrompt && customPrompt.trim() !== "") {
      formData.append("user_prompt", customPrompt.trim());
    }
    if (useSkipWords && skipWords.trim() !== "") {
      formData.append("skip_words", skipWords.trim());
    }
    formData.append("start_page", startPage);
    formData.append("end_page", endPage);

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

  const handleStartLink = (index, isEnglish) => {
    setSelectedForLinking({ index, isEnglish });
  };

  const handleLinkToOther = (index, isEnglish) => {
    if (!selectedForLinking || selectedForLinking.isEnglish === isEnglish) return;

    const enIndex = selectedForLinking.isEnglish ? selectedForLinking.index : index;
    const jpIndex = selectedForLinking.isEnglish ? index : selectedForLinking.index;

    setLinkedPairs((prev) => ({ ...prev, [enIndex]: jpIndex }));
    setSelectedForLinking(null);
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
    const blocks = isEnglish ? [...englishBlocks] : [...japaneseBlocks];
    if (index < blocks.length - 1) {
      blocks[index] += " " + blocks[index + 1];
      blocks.splice(index + 1, 1);
      isEnglish ? setEnglishBlocks(blocks) : setJapaneseBlocks(blocks);
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

  const handleKeyDown = (e, index, isEnglish) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const direction = e.key === "ArrowDown" ? 1 : -1;
      const nextIndex = index + direction;
      const blocks = isEnglish ? englishBlocks : japaneseBlocks;
      const refMap = isEnglish ? englishRefs.current : japaneseRefs.current;
      if (nextIndex >= 0 && nextIndex < blocks.length) {
        setActiveIndex(nextIndex);
        setTimeout(() => {
          const nextEl = refMap[nextIndex];
          if (nextEl) placeCaretAtEnd(nextEl);
        }, 0);
      }
      return;
    }
    if (!isEnglish && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      splitBlock(index, false);
      return;
    }
  };

  const renderEditorBlock = (blocks, isEnglish) => {
    const refMap = isEnglish ? englishRefs.current : japaneseRefs.current;
    return blocks.map((s, i) => (
      <div
        key={`${isEnglish ? "eng" : "jp"}-${i}`}
        className={`block ${i === activeIndex ? "highlighted" : ""} ${selectedForLinking?.index === i && selectedForLinking?.isEnglish === isEnglish ? "linking" : ""} ${linkedPairs[isEnglish ? i : Object.keys(linkedPairs).find(key => linkedPairs[key] === i)] !== undefined ? "linked" : ""}`}
        data-index={i}
        onClick={() => {
          if (selectedForLinking && selectedForLinking.isEnglish !== isEnglish) {
            handleLinkToOther(i, isEnglish);
          }
        }}
      >
        <div
          ref={(el) => {
            if (el) refMap[i] = el;
          }}
          contentEditable
          suppressContentEditableWarning
          onClick={handleCaretChange}
          onKeyUp={handleCaretChange}
          onKeyDown={(e) => handleKeyDown(e, i, isEnglish)}
          onBlur={() => handleBlur(i, isEnglish)}
          className="editable"
          data-index={i}
        >
          {s}
        </div>
        {activeIndex === i && (
          <div className="btn-group">
            <button onClick={() => splitBlock(i, isEnglish)} className="btn-action">
              <SplitSquareVertical size={14} />
            </button>
            {i < blocks.length - 1 && (
              <button onClick={() => mergeBlock(i, isEnglish)} className="btn-action">
                <ArrowUp size={14} />
              </button>
            )}
            {isEnglish ? (
              <>
                <button onClick={() => retranslateBlock(i)} className="btn-action">
                  <RefreshCw size={14} />
                </button>
                <button onClick={() => handleStartLink(i, true)} className="btn-action">
                  🔗
                </button>
              </>
            ) : (
              <>
                <button onClick={() => deleteBlock(i, false)} className="btn-action">
                  <Trash2 size={14} />
                </button>
                <button onClick={() => handleStartLink(i, false)} className="btn-action">
                  🔗
                </button>
              </>
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

          <label>Start Page</label>
          <input type="number" value={startPage} onChange={(e) => setStartPage(Number(e.target.value))} />

          <label>End Page</label>
          <input type="number" value={endPage} onChange={(e) => setEndPage(Number(e.target.value))} />

          <label className="form-check">
            <input type="checkbox" checked={useSkipWords} onChange={(e) => setUseSkipWords(e.target.checked)} />
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
            <input type="checkbox" checked={useCustomPrompt} onChange={(e) => setUseCustomPrompt(e.target.checked)} />
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