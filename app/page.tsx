"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ItemType = "task" | "event" | "reminder" | "personal";
type Priority = "low" | "medium" | "high";
type Status = "inbox" | "scheduled" | "in-progress" | "done";
type Recurrence = "none" | "daily" | "weekly" | "monthly";

type PlannerItem = {
  id: string;
  title: string;
  type: ItemType;
  project: string;
  tag: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  priority: Priority;
  status: Status;
  recurrence: Recurrence;
  notes: string;
};

type DraftItem = {
  title: string;
  type: ItemType;
  project: string;
  tag: string;
  startTime: string;
  duration: number;
  priority: Priority;
  recurrence: Recurrence;
  notes: string;
};

const STORAGE_KEY = "cursor-schedule-items";
const DEFAULT_DATE = "2026-05-18";
const DAY_START = 6;
const DAY_END = 22;
const HOUR_HEIGHT = 86;

const typeLabels: Record<ItemType, string> = {
  task: "Task",
  event: "Event",
  reminder: "Reminder",
  personal: "Personal",
};

const initialDraft: DraftItem = {
  title: "",
  type: "task",
  project: "Inbox",
  tag: "General",
  startTime: "09:00",
  duration: 45,
  priority: "medium",
  recurrence: "none",
  notes: "",
};

const seedItems: PlannerItem[] = [
  {
    id: "seed-standup",
    title: "Team standup and planning notes",
    type: "event",
    project: "Work",
    tag: "Meetings",
    date: DEFAULT_DATE,
    startTime: "09:00",
    endTime: "09:30",
    duration: 30,
    priority: "medium",
    status: "scheduled",
    recurrence: "daily",
    notes: "Review blockers, priorities, and handoffs.",
  },
  {
    id: "seed-focus",
    title: "Deep work: product roadmap draft",
    type: "task",
    project: "Work",
    tag: "Focus",
    date: DEFAULT_DATE,
    startTime: "10:00",
    endTime: "11:30",
    duration: 90,
    priority: "high",
    status: "in-progress",
    recurrence: "none",
    notes: "Protect this block and avoid context switching.",
  },
  {
    id: "seed-lunch",
    title: "Lunch and reset walk",
    type: "personal",
    project: "Personal",
    tag: "Wellness",
    date: DEFAULT_DATE,
    startTime: "12:30",
    endTime: "13:15",
    duration: 45,
    priority: "low",
    status: "scheduled",
    recurrence: "daily",
    notes: "Short outdoor break before the afternoon agenda.",
  },
  {
    id: "seed-followups",
    title: "Send client follow-ups",
    type: "task",
    project: "Clients",
    tag: "Email",
    date: DEFAULT_DATE,
    startTime: "14:00",
    endTime: "14:45",
    duration: 45,
    priority: "high",
    status: "scheduled",
    recurrence: "none",
    notes: "Use the notes from the morning call.",
  },
  {
    id: "seed-review",
    title: "Daily shutdown review",
    type: "reminder",
    project: "Personal",
    tag: "Review",
    date: DEFAULT_DATE,
    startTime: "17:00",
    endTime: "17:30",
    duration: 30,
    priority: "medium",
    status: "scheduled",
    recurrence: "daily",
    notes: "Move unfinished items into tomorrow or the weekly reset.",
  },
  {
    id: "seed-weekly",
    title: "Prepare weekly reset list",
    type: "task",
    project: "Planning",
    tag: "Weekly",
    date: "2026-05-17",
    startTime: "16:00",
    endTime: "16:45",
    duration: 45,
    priority: "medium",
    status: "scheduled",
    recurrence: "weekly",
    notes: "Unfinished sample item for the review queue.",
  },
];

const quickSuggestions = [
  "Water plants at 7:30 PM",
  "Pay rent tomorrow morning",
  "Draft launch checklist at 2 PM",
  "Call dentist next week",
];

function minutesFromTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(totalMinutes: number) {
  const bounded = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(bounded / 60);
  const minutes = bounded % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addMinutes(time: string, minutes: number) {
  return timeFromMinutes(minutesFromTime(time) + minutes);
}

function formatTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function createItem(draft: DraftItem, date: string): PlannerItem {
  const startTime = draft.startTime;
  const duration = Number(draft.duration) || 30;

  return {
    id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: draft.title.trim(),
    type: draft.type,
    project: draft.project.trim() || "Inbox",
    tag: draft.tag.trim() || "General",
    date,
    startTime,
    endTime: addMinutes(startTime, duration),
    duration,
    priority: draft.priority,
    status: "scheduled",
    recurrence: draft.recurrence,
    notes: draft.notes.trim(),
  };
}

function getTimeRows() {
  return Array.from({ length: DAY_END - DAY_START + 1 }, (_, index) => {
    const hour = DAY_START + index;
    return `${String(hour).padStart(2, "0")}:00`;
  });
}

export default function Home() {
  const [items, setItems] = useState<PlannerItem[]>(seedItems);
  const [selectedDate, setSelectedDate] = useState(DEFAULT_DATE);
  const [selectedId, setSelectedId] = useState(seedItems[1].id);
  const [activeFilter, setActiveFilter] = useState("Today");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [draft, setDraft] = useState<DraftItem>(initialDraft);
  const [quickText, setQuickText] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PlannerItem[];
        setItems(parsed);
        setSelectedId(parsed[0]?.id ?? "");
      } catch {
        setItems(seedItems);
      }
    }

    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, mounted]);

  const projects = useMemo(
    () => Array.from(new Set(items.map((item) => item.project))).sort(),
    [items],
  );

  const filterOptions = useMemo(
    () => [
      "Today",
      "Inbox",
      "High priority",
      "Unfinished",
      ...projects.map((project) => `Project: ${project}`),
    ],
    [projects],
  );

  const dayItems = useMemo(
    () =>
      items
        .filter((item) => item.date === selectedDate)
        .filter((item) => {
          if (activeFilter === "Inbox") return item.project === "Inbox";
          if (activeFilter === "High priority") return item.priority === "high";
          if (activeFilter === "Unfinished") return item.status !== "done";
          if (activeFilter.startsWith("Project: ")) {
            return item.project === activeFilter.replace("Project: ", "");
          }

          return true;
        })
        .sort((a, b) => minutesFromTime(a.startTime) - minutesFromTime(b.startTime)),
    [activeFilter, items, selectedDate],
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? dayItems[0],
    [dayItems, items, selectedId],
  );

  const unfinishedItems = useMemo(
    () =>
      items
        .filter((item) => item.status !== "done")
        .filter((item) => item.date < selectedDate || item.date === selectedDate)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return minutesFromTime(a.startTime) - minutesFromTime(b.startTime);
        }),
    [items, selectedDate],
  );

  const focusLoad = dayItems
    .filter((item) => item.status !== "done")
    .reduce((total, item) => total + item.duration, 0);
  const doneCount = dayItems.filter((item) => item.status === "done").length;

  const suggestedItems = useMemo(
    () =>
      [...dayItems]
        .filter((item) => item.status !== "done")
        .sort((a, b) => {
          const priorityScore = { high: 0, medium: 1, low: 2 };
          return (
            priorityScore[a.priority] - priorityScore[b.priority] ||
            minutesFromTime(a.startTime) - minutesFromTime(b.startTime)
          );
        })
        .slice(0, 3),
    [dayItems],
  );

  function updateItem(id: string, changes: Partial<PlannerItem>) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;

        const next = { ...item, ...changes };
        if (changes.startTime || changes.duration) {
          next.endTime = addMinutes(next.startTime, Number(next.duration) || 30);
        }

        return next;
      }),
    );
  }

  function deleteItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedId((current) => (current === id ? "" : current));
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.title.trim()) return;

    const nextItem = createItem(draft, selectedDate);
    setItems((current) => [...current, nextItem]);
    setSelectedId(nextItem.id);
    setDraft(initialDraft);
    setQuickText("");
    setCaptureOpen(false);
  }

  function addQuickText(text = quickText) {
    const title = text.trim();
    if (!title) return;

    const timeMatch = title.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?\b/i);
    let startTime = "09:00";

    if (timeMatch) {
      const meridiem = timeMatch[3]?.toLowerCase();
      let hour = Number(timeMatch[1]);
      const minute = timeMatch[2] ?? "00";

      if (meridiem === "pm" && hour < 12) hour += 12;
      if (meridiem === "am" && hour === 12) hour = 0;
      startTime = `${String(hour).padStart(2, "0")}:${minute}`;
    }

    const nextItem = createItem(
      {
        ...initialDraft,
        title,
        startTime,
        priority: title.toLowerCase().includes("urgent") ? "high" : "medium",
      },
      selectedDate,
    );

    setItems((current) => [...current, nextItem]);
    setSelectedId(nextItem.id);
    setQuickText("");
  }

  function moveItemToTime(id: string, time: string) {
    updateItem(id, {
      date: selectedDate,
      startTime: time,
      status: "scheduled",
    });
  }

  function rescheduleItem(id: string, date = selectedDate) {
    updateItem(id, {
      date,
      status: "scheduled",
    });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Planner navigation">
        <div className="brand">
          <div className="brand-mark">CS</div>
          <div>
            <p className="eyebrow">Cursor Schedule</p>
            <h1>Track your day</h1>
          </div>
        </div>

        <button className="primary-action" onClick={() => setCaptureOpen(true)}>
          Add new task
        </button>

        <div className="quick-capture">
          <label htmlFor="quick-task">Fast capture</label>
          <div className="quick-row">
            <input
              id="quick-task"
              value={quickText}
              onChange={(event) => setQuickText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addQuickText();
              }}
              placeholder="Try: Call mom at 7 PM"
            />
            <button onClick={() => addQuickText()} aria-label="Add quick task">
              Add
            </button>
          </div>
          <div className="suggestion-list">
            {quickSuggestions.map((suggestion) => (
              <button key={suggestion} onClick={() => addQuickText(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <nav className="filter-list" aria-label="Smart filters">
          <p className="section-label">Smart filters</p>
          {filterOptions.map((filter) => (
            <button
              className={activeFilter === filter ? "active" : ""}
              key={filter}
              onClick={() => setActiveFilter(filter)}
            >
              <span>{filter}</span>
              <small>
                {
                  items.filter((item) => {
                    if (filter === "Today") return item.date === selectedDate;
                    if (filter === "Inbox") return item.project === "Inbox";
                    if (filter === "High priority") return item.priority === "high";
                    if (filter === "Unfinished") return item.status !== "done";
                    return item.project === filter.replace("Project: ", "");
                  }).length
                }
              </small>
            </button>
          ))}
        </nav>

        <section className="weekly-review">
          <p className="section-label">Weekly reset</p>
          <h2>{unfinishedItems.length} unfinished items</h2>
          <p>Review loose ends, reschedule what matters, and close out completed work.</p>
          <button
            onClick={() => {
              unfinishedItems.slice(0, 3).forEach((item, index) => {
                updateItem(item.id, {
                  date: selectedDate,
                  startTime: timeFromMinutes(15 * 60 + index * 45),
                  status: "scheduled",
                });
              });
            }}
          >
            Plan next three
          </button>
        </section>
      </aside>

      <section className="agenda-panel">
        <header className="hero">
          <div>
            <p className="eyebrow">Daily agenda</p>
            <h2>{formatDate(selectedDate)}</h2>
            <p>
              A calm, timestamped timeline for tasks, events, reminders, and
              personal stuff.
            </p>
          </div>
          <div className="hero-controls">
            <label>
              Plan date
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
            <button className="ghost-button" onClick={() => setCaptureOpen(true)}>
              Capture anytime
            </button>
          </div>
        </header>

        <section className="stats-grid" aria-label="Daily summary">
          <article>
            <span>{dayItems.length}</span>
            <p>scheduled items</p>
          </article>
          <article>
            <span>{Math.round((focusLoad / 60) * 10) / 10}h</span>
            <p>open workload</p>
          </article>
          <article>
            <span>{doneCount}</span>
            <p>completed today</p>
          </article>
          <article>
            <span>{suggestedItems[0]?.priority ?? "clear"}</span>
            <p>top priority</p>
          </article>
        </section>

        <section className="ai-strip" aria-label="Scheduling suggestions">
          <div>
            <p className="section-label">Smart scheduling</p>
            <h3>Suggested order for the rest of the day</h3>
          </div>
          <div className="ai-cards">
            {suggestedItems.length > 0 ? (
              suggestedItems.map((item, index) => (
                <button key={item.id} onClick={() => setSelectedId(item.id)}>
                  <span>{index + 1}</span>
                  {item.title}
                </button>
              ))
            ) : (
              <p>Everything is clear. Capture a new task when something comes up.</p>
            )}
          </div>
        </section>

        <section className="timeline-card">
          <div className="timeline-heading">
            <div>
              <p className="section-label">Timeline</p>
              <h3>Drag tasks onto timestamps</h3>
            </div>
            <button
              className="ghost-button"
              onClick={() =>
                setItems((current) =>
                  current.map((item) =>
                    item.date === selectedDate && item.status === "done"
                      ? { ...item, status: "scheduled" }
                      : item,
                  ),
                )
              }
            >
              Reset done
            </button>
          </div>

          <div className="timeline" style={{ minHeight: (DAY_END - DAY_START) * HOUR_HEIGHT }}>
            {getTimeRows().map((time) => (
              <div
                className="time-row"
                key={time}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const id = event.dataTransfer.getData("text/plain");
                  if (id) moveItemToTime(id, time);
                }}
              >
                <span>{formatTime(time)}</span>
              </div>
            ))}

            {dayItems.map((item) => {
              const top = ((minutesFromTime(item.startTime) - DAY_START * 60) / 60) * HOUR_HEIGHT;
              const height = Math.max(58, (item.duration / 60) * HOUR_HEIGHT - 8);

              return (
                <article
                  className={`timeline-item ${item.type} ${item.status === "done" ? "done" : ""} ${
                    selectedItem?.id === item.id ? "selected" : ""
                  }`}
                  draggable
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)}
                  style={{
                    top,
                    height,
                  }}
                >
                  <div>
                    <p>
                      {formatTime(item.startTime)} - {formatTime(item.endTime)}
                    </p>
                    <h4>{item.title}</h4>
                    <span>
                      {typeLabels[item.type]} / {item.project} / {item.tag}
                    </span>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      updateItem(item.id, {
                        status: item.status === "done" ? "scheduled" : "done",
                      });
                    }}
                  >
                    {item.status === "done" ? "Reopen" : "Done"}
                  </button>
                </article>
              );
            })}

            {dayItems.length === 0 && (
              <div className="empty-state">
                <p className="section-label">No items yet</p>
                <h3>Start with one small thing to track.</h3>
                <p>
                  Add a task, event, reminder, or personal note and it will appear on
                  this timestamped agenda.
                </p>
                <button onClick={() => setCaptureOpen(true)}>Create first item</button>
              </div>
            )}
          </div>
        </section>
      </section>

      <aside className="detail-panel" aria-label="Selected item details">
        {selectedItem ? (
          <>
            <div className="detail-header">
              <p className="section-label">Details</p>
              <button onClick={() => deleteItem(selectedItem.id)}>Delete</button>
            </div>

            <label>
              Title
              <input
                value={selectedItem.title}
                onChange={(event) => updateItem(selectedItem.id, { title: event.target.value })}
              />
            </label>

            <div className="field-grid">
              <label>
                Type
                <select
                  value={selectedItem.type}
                  onChange={(event) =>
                    updateItem(selectedItem.id, { type: event.target.value as ItemType })
                  }
                >
                  {Object.keys(typeLabels).map((type) => (
                    <option key={type} value={type}>
                      {typeLabels[type as ItemType]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select
                  value={selectedItem.priority}
                  onChange={(event) =>
                    updateItem(selectedItem.id, { priority: event.target.value as Priority })
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>

            <div className="field-grid">
              <label>
                Start
                <input
                  type="time"
                  value={selectedItem.startTime}
                  onChange={(event) => updateItem(selectedItem.id, { startTime: event.target.value })}
                />
              </label>
              <label>
                Duration
                <input
                  min="15"
                  step="15"
                  type="number"
                  value={selectedItem.duration}
                  onChange={(event) =>
                    updateItem(selectedItem.id, { duration: Number(event.target.value) })
                  }
                />
              </label>
            </div>

            <div className="field-grid">
              <label>
                Project
                <input
                  value={selectedItem.project}
                  onChange={(event) => updateItem(selectedItem.id, { project: event.target.value })}
                />
              </label>
              <label>
                Tag
                <input
                  value={selectedItem.tag}
                  onChange={(event) => updateItem(selectedItem.id, { tag: event.target.value })}
                />
              </label>
            </div>

            <label>
              Recurring
              <select
                value={selectedItem.recurrence}
                onChange={(event) =>
                  updateItem(selectedItem.id, { recurrence: event.target.value as Recurrence })
                }
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>

            <label>
              Notes
              <textarea
                value={selectedItem.notes}
                onChange={(event) => updateItem(selectedItem.id, { notes: event.target.value })}
                rows={5}
              />
            </label>

            <div className="status-card">
              <p>Status</p>
              <div className="status-actions">
                {(["inbox", "scheduled", "in-progress", "done"] as Status[]).map((status) => (
                  <button
                    className={selectedItem.status === status ? "active" : ""}
                    key={status}
                    onClick={() => updateItem(selectedItem.id, { status })}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <section className="review-list">
              <p className="section-label">Unfinished review</p>
              {unfinishedItems.slice(0, 4).map((item) => (
                <button key={item.id} onClick={() => rescheduleItem(item.id)}>
                  <span>{item.title}</span>
                  <small>{item.date === selectedDate ? "Today" : item.date}</small>
                </button>
              ))}
            </section>
          </>
        ) : (
          <div className="empty-detail">
            <p className="section-label">Details</p>
            <h3>Select or create an item</h3>
            <p>Your edits, notes, recurrence, priority, and status will appear here.</p>
          </div>
        )}
      </aside>

      {captureOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="capture-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading">
              <div>
                <p className="section-label">Anytime capture</p>
                <h2 id="modal-title">Add a new task or event</h2>
              </div>
              <button onClick={() => setCaptureOpen(false)} aria-label="Close modal">
                Close
              </button>
            </div>

            <form onSubmit={submitDraft}>
              <label>
                What do you want to track?
                <input
                  autoFocus
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="Write the task, reminder, event, or personal stuff"
                />
              </label>

              <div className="field-grid">
                <label>
                  Type
                  <select
                    value={draft.type}
                    onChange={(event) => setDraft({ ...draft, type: event.target.value as ItemType })}
                  >
                    {Object.keys(typeLabels).map((type) => (
                      <option key={type} value={type}>
                        {typeLabels[type as ItemType]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={draft.priority}
                    onChange={(event) =>
                      setDraft({ ...draft, priority: event.target.value as Priority })
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </div>

              <div className="field-grid">
                <label>
                  Start time
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
                  />
                </label>
                <label>
                  Duration
                  <input
                    min="15"
                    step="15"
                    type="number"
                    value={draft.duration}
                    onChange={(event) => setDraft({ ...draft, duration: Number(event.target.value) })}
                  />
                </label>
              </div>

              <div className="field-grid">
                <label>
                  Project
                  <input
                    value={draft.project}
                    onChange={(event) => setDraft({ ...draft, project: event.target.value })}
                  />
                </label>
                <label>
                  Tag
                  <input
                    value={draft.tag}
                    onChange={(event) => setDraft({ ...draft, tag: event.target.value })}
                  />
                </label>
              </div>

              <label>
                Repeat
                <select
                  value={draft.recurrence}
                  onChange={(event) =>
                    setDraft({ ...draft, recurrence: event.target.value as Recurrence })
                  }
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>

              <label>
                Notes
                <textarea
                  value={draft.notes}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  placeholder="Add context, checklist notes, or reminders"
                  rows={4}
                />
              </label>

              <div className="modal-actions">
                <button type="button" onClick={() => setCaptureOpen(false)}>
                  Cancel
                </button>
                <button className="primary-action" type="submit">
                  Add to timeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
