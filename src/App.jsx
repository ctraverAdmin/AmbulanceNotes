import React, { useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "ambulanceBoardNotesApp_v9";

const defaultRules = [
  {
    id: crypto.randomUUID(),
    matchType: "vendor",
    matchText: "DAILEY RESOURCES",
    note: "Payment for ambulance operational supplies or services.",
  },
  {
    id: crypto.randomUUID(),
    matchType: "vendor",
    matchText: "D&C FUEL",
    note: "Fuel expense for ambulance operations.",
  },
  {
    id: crypto.randomUUID(),
    matchType: "vendor",
    matchText: "INLAND WATER SPORTS",
    note: "Payment for ambulance operational equipment, supplies, or services.",
  },
  {
    id: crypto.randomUUID(),
    matchType: "vendor",
    matchText: "INTERNAL REVENUE SERVICE",
    note: "Federal payroll tax payment.",
  },
  {
    id: crypto.randomUUID(),
    matchType: "vendor",
    matchText: "INTUIT - PAYROLL",
    note: "Payroll processing and payroll-related expense.",
  },
  {
    id: crypto.randomUUID(),
    matchType: "vendor",
    matchText: "KUNKLE FIRE",
    note: "ALS TRIP BILLING",
  },
  {
    id: crypto.randomUUID(),
    matchType: "vendor",
    matchText: "PENTELEDATA",
    note: "Monthly internet service expense for ambulance operations.",
  },
];

function getInitialState() {
  return {
    reportMonth: "",
    reportTitle: "Monthly Board Financial Notes",
    pastedText: "",
    rows: [],
    financialNotes: [],
    rules: defaultRules,
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return getInitialState();

    const parsed = JSON.parse(saved);

    return {
      ...getInitialState(),
      ...parsed,
      rows: parsed.rows || [],
      financialNotes: parsed.financialNotes || [],
      rules: parsed.rules?.length ? parsed.rules : defaultRules,
    };
  } catch {
    return getInitialState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalize(text) {
  return String(text || "").trim().toLowerCase();
}

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\bqb\b/gi, "QuickBooks")
    .replace(/\butil\b/gi, "utility")
    .replace(/\bins\b/gi, "insurance")
    .replace(/\bmaint\b/gi, "maintenance")
    .trim();
}

function formatVendorName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function cleanMemoForPrint(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAmount(value) {
  if (value === null || value === undefined || value === "") return 0;

  const original = String(value).trim();
  const isAccountingNegative =
    original.includes("(") && original.includes(")");

  const cleaned = original
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .trim();

  let number = Number(cleaned);

  if (Number.isNaN(number)) return 0;

  if (isAccountingNegative) {
    number = number * -1;
  }

  return number;
}

function normalizeExpenseAmount(value, transactionType) {
  if (value === null || value === undefined || value === "") return "";

  const number = parseAmount(value);
  const type = normalize(transactionType);

  const shouldBePositive =
    type === "expense" ||
    type === "bill" ||
    type === "check" ||
    type === "credit card expense";

  if (shouldBePositive) {
    return Math.abs(number).toFixed(2);
  }

  return number.toFixed(2);
}

function money(value) {
  if (value === null || value === undefined || value === "") return "";

  const number = Math.abs(parseAmount(value));

  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function amountToNumber(value) {
  return Math.abs(parseAmount(value));
}

function parseDelimitedLine(line) {
  const cells = [];
  let current = "";
  let insideQuotes = false;

  const delimiter = line.includes("\t") ? "\t" : ",";

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function splitPastedRows(text) {
  const rows = [];
  let currentLine = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && nextChar === '"') {
      currentLine += '""';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      currentLine += char;
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (currentLine.trim()) {
        rows.push(currentLine);
      }

      currentLine = "";

      if (char === "\r" && nextChar === "\n") {
        i++;
      }

      continue;
    }

    currentLine += char;
  }

  if (currentLine.trim()) {
    rows.push(currentLine);
  }

  return rows.map(parseDelimitedLine);
}

function findColumn(headers, possibleNames) {
  const normalizedHeaders = headers.map((h) => normalize(h));

  for (const name of possibleNames) {
    const index = normalizedHeaders.findIndex((h) => h === normalize(name));
    if (index >= 0) return index;
  }

  for (const name of possibleNames) {
    const index = normalizedHeaders.findIndex((h) =>
      h.includes(normalize(name))
    );
    if (index >= 0) return index;
  }

  return -1;
}

function createAutoNote(row, rules) {
  const vendor = cleanText(row.vendor);
  const account = cleanText(row.account);
  const memo = cleanText(row.memo);
  const transactionType = cleanText(row.transactionType);
  const num = cleanText(row.num);
  const posting = cleanText(row.posting);

  const matchedRule = rules.find((rule) => {
    const ruleText = normalize(rule.matchText);

    if (!ruleText) return false;

    let target = "";

    if (rule.matchType === "vendor") {
      target = vendor;
    } else if (rule.matchType === "account") {
      target = account;
    } else if (rule.matchType === "memo") {
      target = memo;
    } else {
      target = `${vendor} ${account} ${memo} ${transactionType} ${num} ${posting}`;
    }

    return normalize(target).includes(ruleText);
  });

  if (matchedRule) {
    return {
      note: matchedRule.note,
      status: "Rule Matched",
    };
  }

  return {
    note: "Needs review — no rule matched.",
    status: "Needs Review",
  };
}

function isKunkleFireRow(row) {
  const vendor = formatVendorName(row.vendor);
  return vendor.includes("KUNKLE FIRE");
}

function getPrintedBoardNote(row) {
  const memo = cleanMemoForPrint(row.memo);

  if (isKunkleFireRow(row)) {
    if (memo) {
      return `ALS Billing — ${memo}`;
    }

    return "ALS Billing — memo not provided.";
  }

  return row.boardNote;
}

function getVendorSummaryNote(row) {
  if (isKunkleFireRow(row)) {
    return "ALS Billing";
  }

  return getPrintedBoardNote(row);
}

function App() {
  const [state, setState] = useState(loadState());

  const [newRule, setNewRule] = useState({
    matchType: "vendor",
    matchText: "",
    note: "",
  });

  const [newFinancialNote, setNewFinancialNote] = useState({
    date: "",
    description: "",
    amount: "",
    note: "",
  });

  function updateState(changes) {
    const updated = { ...state, ...changes };
    setState(updated);
    saveState(updated);
  }

  function updateRow(id, field, value) {
    const rows = state.rows.map((row) =>
      row.id === id ? { ...row, [field]: value } : row
    );

    updateState({ rows });
  }

  function parsePaste() {
    const table = splitPastedRows(state.pastedText);

    if (table.length < 2) {
      alert(
        "Paste the header row and at least one transaction row from QuickBooks or Excel."
      );
      return;
    }

    const headers = table[0];

    const vendorIndex = findColumn(headers, ["Vendor", "Name", "Payee"]);
    const dateIndex = findColumn(headers, ["Date", "Transaction Date"]);
    const transactionTypeIndex = findColumn(headers, [
      "Transaction type",
      "Transaction Type",
      "Type",
    ]);
    const numIndex = findColumn(headers, [
      "Num",
      "Number",
      "Ref No.",
      "Reference",
    ]);
    const postingIndex = findColumn(headers, [
      "Posting (Y/N)",
      "Posting",
      "Posted",
    ]);
    const memoIndex = findColumn(headers, [
      "Memo",
      "Description",
      "Memo/Description",
    ]);
    const accountIndex = findColumn(headers, [
      "Account full name",
      "Account",
      "Category",
      "Distribution Account",
    ]);
    const amountIndex = findColumn(headers, [
      "Amount",
      "Total",
      "Debit",
      "Credit",
    ]);

    if (vendorIndex < 0 || dateIndex < 0 || amountIndex < 0) {
      alert(
        "I could not find the Vendor, Date, or Amount column. Make sure your header row includes Vendor, Date, and Amount."
      );
      return;
    }

    let parsedRows = table
      .slice(1)
      .filter((cells) => {
        const vendor = cells[vendorIndex] || "";
        const date = cells[dateIndex] || "";
        const amount = cells[amountIndex] || "";
        const firstCell = cells[0] || "";

        if (normalize(firstCell).startsWith("total for")) return false;

        return vendor || date || amount;
      })
      .map((cells) => {
        const transactionType =
          transactionTypeIndex >= 0 ? cells[transactionTypeIndex] || "" : "";

        const row = {
          id: crypto.randomUUID(),
          vendor:
            vendorIndex >= 0 ? formatVendorName(cells[vendorIndex] || "") : "",
          date: dateIndex >= 0 ? cells[dateIndex] || "" : "",
          transactionType,
          num: numIndex >= 0 ? cells[numIndex] || "" : "",
          posting: postingIndex >= 0 ? cells[postingIndex] || "" : "",
          memo: memoIndex >= 0 ? cells[memoIndex] || "" : "",
          account: accountIndex >= 0 ? cells[accountIndex] || "" : "",
          amount:
            amountIndex >= 0
              ? normalizeExpenseAmount(
                  cells[amountIndex] || "",
                  transactionType
                )
              : "",
        };

        const generated = createAutoNote(row, state.rules);

        return {
          ...row,
          boardNote: generated.note,
          status: generated.status,
        };
      });

    const needsReviewVendors = [
      ...new Set(
        parsedRows
          .filter((row) => row.status === "Needs Review")
          .map((row) => formatVendorName(row.vendor))
          .filter(Boolean)
      ),
    ];

    const newRulesFromPrompts = [];

    for (const vendor of needsReviewVendors) {
      const vendorRows = parsedRows.filter(
        (row) => formatVendorName(row.vendor) === vendor
      );

      const vendorTotal = vendorRows.reduce(
        (sum, row) => sum + amountToNumber(row.amount),
        0
      );

      const sampleMemo =
        vendorRows.find((row) => cleanMemoForPrint(row.memo))?.memo || "";

      const enteredNote = prompt(
        `Needs Review:

Vendor: ${vendor}
Transactions: ${vendorRows.length}
Total: ${money(vendorTotal)}${
          sampleMemo ? `\nSample memo: ${cleanMemoForPrint(sampleMemo)}` : ""
        }

What summary note should be used for this vendor?`
      );

      if (enteredNote && enteredNote.trim()) {
        const cleanNote = enteredNote.trim();

        parsedRows = parsedRows.map((row) =>
          formatVendorName(row.vendor) === vendor
            ? {
                ...row,
                boardNote: cleanNote,
                status: "Rule Matched",
              }
            : row
        );

        const saveForFuture = confirm(
          `Do you want to save this note for future reports?

Vendor: ${vendor}
Note: ${cleanNote}`
        );

        if (saveForFuture) {
          newRulesFromPrompts.push({
            id: crypto.randomUUID(),
            matchType: "vendor",
            matchText: vendor,
            note: cleanNote,
          });
        }
      }
    }

    const updatedRules =
      newRulesFromPrompts.length > 0
        ? [...state.rules, ...newRulesFromPrompts]
        : state.rules;

    updateState({
      rows: parsedRows,
      rules: updatedRules,
    });
  }

  function regenerateNotes() {
    const rows = state.rows.map((row) => {
      const generated = createAutoNote(row, state.rules);

      return {
        ...row,
        boardNote: generated.note,
        status: generated.status,
      };
    });

    updateState({ rows });
  }

  function addFinancialNote() {
    if (
      !newFinancialNote.date.trim() &&
      !newFinancialNote.description.trim() &&
      !newFinancialNote.amount.trim() &&
      !newFinancialNote.note.trim()
    ) {
      alert("Add a date, description, amount, or note before saving.");
      return;
    }

    const updatedNotes = [
      ...(state.financialNotes || []),
      {
        id: crypto.randomUUID(),
        date: newFinancialNote.date.trim(),
        description: newFinancialNote.description.trim(),
        amount: newFinancialNote.amount.trim(),
        note: newFinancialNote.note.trim(),
      },
    ];

    updateState({ financialNotes: updatedNotes });

    setNewFinancialNote({
      date: "",
      description: "",
      amount: "",
      note: "",
    });
  }

  function updateFinancialNote(id, field, value) {
    const updatedNotes = (state.financialNotes || []).map((note) =>
      note.id === id ? { ...note, [field]: value } : note
    );

    updateState({ financialNotes: updatedNotes });
  }

  function deleteFinancialNote(id) {
    const ok = confirm("Delete this financial note?");
    if (!ok) return;

    const updatedNotes = (state.financialNotes || []).filter(
      (note) => note.id !== id
    );

    updateState({ financialNotes: updatedNotes });
  }

  function addRule() {
    if (!newRule.matchText.trim() || !newRule.note.trim()) {
      alert("Add both the match text and the board note.");
      return;
    }

    const updatedRules = [
      ...state.rules,
      {
        id: crypto.randomUUID(),
        matchType: newRule.matchType,
        matchText:
          newRule.matchType === "vendor"
            ? formatVendorName(newRule.matchText.trim())
            : newRule.matchText.trim(),
        note: newRule.note.trim(),
      },
    ];

    updateState({ rules: updatedRules });

    setNewRule({
      matchType: "vendor",
      matchText: "",
      note: "",
    });
  }

  function deleteRule(id) {
    const updatedRules = state.rules.filter((rule) => rule.id !== id);
    updateState({ rules: updatedRules });
  }

  function clearReport() {
    const ok = confirm("Clear the pasted report and transaction rows?");
    if (!ok) return;

    updateState({
      pastedText: "",
      rows: [],
    });
  }

  function clearFinancialNotes() {
    const ok = confirm(
      "Clear all financial notes that are not included in totals?"
    );
    if (!ok) return;

    updateState({
      financialNotes: [],
    });
  }

  function resetRules() {
    const ok = confirm("Reset rules back to the starter rules?");
    if (!ok) return;

    updateState({
      rules: defaultRules,
    });
  }

  const totals = useMemo(() => {
    let total = 0;
    let reviewCount = 0;
    let matchedCount = 0;

    for (const row of state.rows) {
      total += amountToNumber(row.amount);

      if (row.status === "Needs Review") reviewCount += 1;
      if (row.status === "Rule Matched") matchedCount += 1;
    }

    return {
      total,
      reviewCount,
      matchedCount,
      rowCount: state.rows.length,
    };
  }, [state.rows]);

  const vendorSummary = useMemo(() => {
    const grouped = {};

    for (const row of state.rows) {
      const vendor = formatVendorName(row.vendor || "UNKNOWN VENDOR");
      const note = getVendorSummaryNote(row);

      if (!grouped[vendor]) {
        grouped[vendor] = {
          vendor,
          total: 0,
          count: 0,
          notes: [],
        };
      }

      grouped[vendor].total += amountToNumber(row.amount);
      grouped[vendor].count += 1;

      if (
        note &&
        note !== "Needs review — no rule matched." &&
        !grouped[vendor].notes.includes(note)
      ) {
        grouped[vendor].notes.push(note);
      }
    }

    return Object.values(grouped)
      .map((vendor) => ({
        ...vendor,
        summaryNote:
          vendor.notes.length > 0
            ? vendor.notes.join(" ")
            : "Needs review — no rule matched.",
      }))
      .sort((a, b) => a.vendor.localeCompare(b.vendor));
  }, [state.rows]);

  const vendorGrandTotal = useMemo(() => {
    return vendorSummary.reduce(
      (sum, vendor) => sum + amountToNumber(vendor.total),
      0
    );
  }, [vendorSummary]);

  return (
    <div className="app-shell">
      <header className="top-header no-print">
        <div>
          <p className="eyebrow">Ambulance Board Reporting</p>
          <h1>Monthly Board Financial Notes Builder</h1>
          <p className="subtitle">
            Paste your QuickBooks report, apply only your approved note rules,
            review anything unmatched, and print a clean board report.
          </p>
        </div>

        <button className="print-button" onClick={() => window.print()}>
          Print Board Report
        </button>
      </header>

      <section className="card report-settings no-print">
        <div>
          <label>Report Title</label>
          <input
            value={state.reportTitle}
            onChange={(e) => updateState({ reportTitle: e.target.value })}
          />
        </div>

        <div>
          <label>Report Month</label>
          <input
            value={state.reportMonth}
            placeholder="Example: April 2026"
            onChange={(e) => updateState({ reportMonth: e.target.value })}
          />
        </div>
      </section>

      <section className="stats no-print">
        <div className="stat-card">
          <span>Total Rows</span>
          <strong>{totals.rowCount}</strong>
        </div>

        <div className="stat-card">
          <span>Rule Matched</span>
          <strong>{totals.matchedCount}</strong>
        </div>

        <div className="stat-card warning-stat">
          <span>Needs Review</span>
          <strong>{totals.reviewCount}</strong>
        </div>

        <div className="stat-card">
          <span>Total Amount</span>
          <strong>{money(totals.total)}</strong>
        </div>

        <div className="stat-card info-stat">
          <span>Separate Financial Notes</span>
          <strong>{(state.financialNotes || []).length}</strong>
        </div>
      </section>

      <section className="card paste-section no-print">
        <div className="section-heading">
          <div>
            <h2>1. Paste QuickBooks Report</h2>
            <p>
              Use this column order: Vendor, Date, Transaction type, Num,
              Posting (Y/N), Memo, Account full name, Amount.
            </p>
          </div>

          <div className="button-row">
            <button onClick={parsePaste}>Generate Notes</button>
            <button className="secondary" onClick={regenerateNotes}>
              Reapply Rules
            </button>
            <button className="danger" onClick={clearReport}>
              Clear Report
            </button>
          </div>
        </div>

        <textarea
          value={state.pastedText}
          onChange={(e) => updateState({ pastedText: e.target.value })}
          placeholder={
            "Paste rows here, including the header row:\nVendor\tDate\tTransaction type\tNum\tPosting (Y/N)\tMemo\tAccount full name\tAmount"
          }
        />
      </section>

      <section className="card full-width-card no-print">
        <div className="section-heading">
          <div>
            <h2>2. Review Transaction Notes</h2>
            <p>
              Notes are created only from your rules. Kunkle Fire printed
              transaction details will show ALS Billing plus the memo.
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="review-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Date</th>
                <th>Type</th>
                <th>Num</th>
                <th>Posting</th>
                <th>Memo</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Board Note</th>
              </tr>
            </thead>

            <tbody>
              {state.rows.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty-cell">
                    No rows yet. Paste your QuickBooks report above and click
                    Generate Notes.
                  </td>
                </tr>
              ) : (
                state.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        value={row.vendor}
                        onChange={(e) =>
                          updateRow(
                            row.id,
                            "vendor",
                            formatVendorName(e.target.value)
                          )
                        }
                      />
                    </td>

                    <td>
                      <input
                        value={row.date}
                        onChange={(e) =>
                          updateRow(row.id, "date", e.target.value)
                        }
                      />
                    </td>

                    <td>
                      <input
                        value={row.transactionType}
                        onChange={(e) =>
                          updateRow(row.id, "transactionType", e.target.value)
                        }
                      />
                    </td>

                    <td>
                      <input
                        value={row.num}
                        onChange={(e) =>
                          updateRow(row.id, "num", e.target.value)
                        }
                      />
                    </td>

                    <td>
                      <input
                        value={row.posting}
                        onChange={(e) =>
                          updateRow(row.id, "posting", e.target.value)
                        }
                      />
                    </td>

                    <td>
                      <textarea
                        className="memo-box"
                        value={row.memo}
                        onChange={(e) =>
                          updateRow(row.id, "memo", e.target.value)
                        }
                      />
                    </td>

                    <td>
                      <input
                        value={row.account}
                        onChange={(e) =>
                          updateRow(row.id, "account", e.target.value)
                        }
                      />
                    </td>

                    <td>
                      <input
                        value={row.amount}
                        onChange={(e) =>
                          updateRow(
                            row.id,
                            "amount",
                            normalizeExpenseAmount(
                              e.target.value,
                              row.transactionType
                            )
                          )
                        }
                      />
                    </td>

                    <td>
                      <span
                        className={
                          row.status === "Needs Review"
                            ? "badge review"
                            : "badge good"
                        }
                      >
                        {row.status}
                      </span>
                    </td>

                    <td>
                      <textarea
                        className="note-box"
                        value={row.boardNote}
                        onChange={(e) =>
                          updateRow(row.id, "boardNote", e.target.value)
                        }
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card full-width-card no-print">
        <div className="section-heading">
          <div>
            <h2>3. Special Financial Notes</h2>
            <p>
              Use this for financial explanations, pending items, timing notes,
              voids, transfers, or reminders that should print on the board
              report but should not affect the transaction totals.
            </p>
          </div>

          <button className="danger" onClick={clearFinancialNotes}>
            Clear Financial Notes
          </button>
        </div>

        <div className="rule-form">
          <input
            value={newFinancialNote.date}
            placeholder="Date, if applicable"
            onChange={(e) =>
              setNewFinancialNote({
                ...newFinancialNote,
                date: e.target.value,
              })
            }
          />

          <input
            value={newFinancialNote.description}
            placeholder="Description"
            onChange={(e) =>
              setNewFinancialNote({
                ...newFinancialNote,
                description: e.target.value,
              })
            }
          />

          <input
            value={newFinancialNote.amount}
            placeholder="Amount, if applicable"
            onChange={(e) =>
              setNewFinancialNote({
                ...newFinancialNote,
                amount: e.target.value,
              })
            }
          />

          <input
            value={newFinancialNote.note}
            placeholder="Financial note"
            onChange={(e) =>
              setNewFinancialNote({
                ...newFinancialNote,
                note: e.target.value,
              })
            }
          />

          <button onClick={addFinancialNote}>Add Financial Note</button>
        </div>

        <div className="table-wrap">
          <table className="review-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Note</th>
                <th>Delete</th>
              </tr>
            </thead>

            <tbody>
              {(state.financialNotes || []).length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    No separate financial notes have been added.
                  </td>
                </tr>
              ) : (
                (state.financialNotes || []).map((note) => (
                  <tr key={note.id}>
                    <td>
                      <input
                        value={note.date}
                        onChange={(e) =>
                          updateFinancialNote(
                            note.id,
                            "date",
                            e.target.value
                          )
                        }
                      />
                    </td>

                    <td>
                      <input
                        value={note.description}
                        onChange={(e) =>
                          updateFinancialNote(
                            note.id,
                            "description",
                            e.target.value
                          )
                        }
                      />
                    </td>

                    <td>
                      <input
                        value={note.amount}
                        onChange={(e) =>
                          updateFinancialNote(
                            note.id,
                            "amount",
                            e.target.value
                          )
                        }
                      />
                    </td>

                    <td>
                      <textarea
                        className="note-box"
                        value={note.note}
                        onChange={(e) =>
                          updateFinancialNote(
                            note.id,
                            "note",
                            e.target.value
                          )
                        }
                      />
                    </td>

                    <td>
                      <button
                        className="danger small"
                        onClick={() => deleteFinancialNote(note.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card rules-section no-print">
        <div className="section-heading">
          <div>
            <h2>4. Reusable Note Rules</h2>
            <p>
              These are the only notes the app uses. Add your approved wording
              here once, then reuse it every month.
            </p>
          </div>

          <button className="secondary" onClick={resetRules}>
            Reset Starter Rules
          </button>
        </div>

        <div className="rule-form">
          <select
            value={newRule.matchType}
            onChange={(e) =>
              setNewRule({ ...newRule, matchType: e.target.value })
            }
          >
            <option value="vendor">Vendor contains</option>
            <option value="account">Account contains</option>
            <option value="memo">Memo contains</option>
            <option value="any">Any field contains</option>
          </select>

          <input
            value={newRule.matchText}
            placeholder="Example: PENTELEDATA"
            onChange={(e) =>
              setNewRule({
                ...newRule,
                matchText:
                  newRule.matchType === "vendor"
                    ? formatVendorName(e.target.value)
                    : e.target.value,
              })
            }
          />

          <input
            value={newRule.note}
            placeholder="Example: Monthly internet service expense for ambulance operations."
            onChange={(e) =>
              setNewRule({ ...newRule, note: e.target.value })
            }
          />

          <button onClick={addRule}>Add Rule</button>
        </div>

        <div className="rules-list">
          {state.rules.map((rule) => (
            <div className="rule-item" key={rule.id}>
              <div>
                <strong>{rule.matchType}</strong> contains{" "}
                <strong>
                  {rule.matchType === "vendor"
                    ? formatVendorName(rule.matchText)
                    : rule.matchText}
                </strong>
                <p>{rule.note}</p>
              </div>

              <button
                className="danger small"
                onClick={() => deleteRule(rule.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>

      <main className="print-report">
        <div className="print-title">
          <h1>{state.reportTitle}</h1>
          <h2>{state.reportMonth}</h2>
        </div>

        <div className="print-summary">
          <p>
            <strong>Total Transactions:</strong> {totals.rowCount}
          </p>
          <p>
            <strong>Rule Matched:</strong> {totals.matchedCount}
          </p>
          <p>
            <strong>Needs Review:</strong> {totals.reviewCount}
          </p>
          <p>
            <strong>Total Amount:</strong> {money(totals.total)}
          </p>
        </div>

        <h3>Vendor Summary</h3>

        <table className="print-table vendor-summary-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Transactions</th>
              <th>Total</th>
              <th>Summary Note</th>
            </tr>
          </thead>

          <tbody>
            {vendorSummary.map((vendor) => (
              <tr key={vendor.vendor}>
                <td>{vendor.vendor}</td>
                <td>{vendor.count}</td>
                <td>{money(vendor.total)}</td>
                <td>{vendor.summaryNote}</td>
              </tr>
            ))}

            <tr className="vendor-grand-total-row">
              <td>Grand Total</td>
              <td></td>
              <td>{money(vendorGrandTotal)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        {(state.financialNotes || []).length > 0 && (
          <section className="financial-notes-print-section">
            <h3>Special Financial Notes</h3>

            <table className="print-table financial-notes-print-table">
              <colgroup>
                <col className="financial-date-col" />
                <col className="financial-description-col" />
                <col className="financial-amount-col" />
                <col className="financial-note-col" />
              </colgroup>

              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Note</th>
                </tr>
              </thead>

              <tbody>
                {(state.financialNotes || []).map((note) => (
                  <tr key={note.id}>
                    <td>{note.date}</td>
                    <td>{note.description}</td>
                    <td>{note.amount ? money(note.amount) : ""}</td>
                    <td className="financial-note-wrap">{note.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="financial-note-disclaimer">
              These financial notes are informational only as special items that came in during the month.
            </p>
          </section>
        )}

        <h3>Transaction Detail</h3>

        <table className="print-table transaction-detail-print-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Board Note</th>
            </tr>
          </thead>

          <tbody>
            {state.rows.map((row) => (
              <tr
                key={row.id}
                className={isKunkleFireRow(row) ? "kunkle-print-row" : ""}
              >
                <td>{formatVendorName(row.vendor)}</td>
                <td>{row.date}</td>
                <td>{money(row.amount)}</td>
                <td>{getPrintedBoardNote(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}

export default App;