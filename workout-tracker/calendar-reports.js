const categories = {
  workout: { label: 'Workout', plural: 'Workouts', icon: 'dumbbell' },
  meal: { label: 'Meal', plural: 'Meals', icon: 'utensils' },
  weight: { label: 'Weigh-in', plural: 'Weigh-ins', icon: 'scale' },
  prayer: { label: 'Prayer', plural: 'Prayers', icon: 'book' }
}

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const calendarState = new WeakMap()
const reportState = new WeakMap()

function localDay(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDay(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function shiftDay(iso, distance) {
  const date = parseDay(iso)
  date.setDate(date.getDate() + distance)
  return localDay(date)
}

function formatDay(iso, options) {
  return parseDay(iso).toLocaleDateString('en-US', options)
}

function startOfWeek(iso) {
  const offset = (parseDay(iso).getDay() + 6) % 7
  return shiftDay(iso, -offset)
}

function monthStart(iso) {
  return iso.slice(0, 7) + '-01'
}

function shiftMonth(iso, distance) {
  const day = parseDay(monthStart(iso))
  day.setMonth(day.getMonth() + distance)
  return localDay(day)
}

function readableRange(start, end) {
  if (start === end) return formatDay(start, { month: 'long', day: 'numeric', year: 'numeric' })
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  const first = formatDay(start, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' })
  const last = formatDay(end, { month: sameMonth ? undefined : 'short', day: 'numeric' })
  return `${first} – ${last}, ${end.slice(0, 4)}`
}

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

function quantity(value, single, multiple = single + 's') {
  return `${integer.format(value)} ${value === 1 ? single : multiple}`
}

function mass(kg, unit) {
  return unit === 'lb' ? kg * 2.20462262185 : kg
}

function byDate(records) {
  const groups = new Map()
  for (const item of records) {
    if (!Object.hasOwn(categories, item.type)) continue
    if (!groups.has(item.date)) groups.set(item.date, [])
    groups.get(item.date).push(item)
  }
  return groups
}

function navButton(icon, name, title, action) {
  return `<button type="button" class="cr-arrow" aria-label="${title}" title="${title}" data-cr-act="${action}">${icon(name, 17)}</button>`
}

function todayButton(label) {
  return `<button type="button" class="cr-reset" data-cr-act="today">${label}</button>`
}

function mark(type) {
  return `<span aria-hidden="true" class="cr-dot cr-${type}"></span>`
}

function bind(container, action, callback) {
  container.querySelector(`[data-cr-act="${action}"]`)?.addEventListener('click', callback)
}

function refocus(container, selector) {
  container.querySelector(selector)?.focus({ preventScroll: true })
}

export function renderCalendar(container, options) {
  const { records, date, onDate, icon } = options
  const today = localDay(new Date())
  let state = calendarState.get(container)
  if (!state || state.date !== date) {
    state = { date, month: monthStart(date) }
    calendarState.set(container, state)
  }

  const { month } = state
  const first = startOfWeek(month)
  const nextMonth = shiftMonth(month, 1)
  const last = shiftDay(nextMonth, -1)
  const endOfGrid = shiftDay(startOfWeek(last), 6)
  const groups = byDate(records)
  const cells = []
  let activeDays = 0
  let entryCount = 0
  for (let day = first; day <= endOfGrid; day = shiftDay(day, 1)) {
    const entries = groups.get(day) || []
    const currentMonth = monthStart(day) === month
    if (currentMonth && entries.length) {
      activeDays++
      entryCount += entries.length
    }
    const types = Object.keys(categories).filter(type => entries.some(entry => entry.type === type))
    const label = [formatDay(day, {weekday:'long', month:'long', day:'numeric', year:'numeric'}), quantity(entries.length, 'entry', 'entries'), ...types.map(type => categories[type].label)].join(', ')
    const selected = day === date ? ' is-selected' : ''
    const current = day === today ? ' aria-current="date"' : ''
    cells.push(`<button type="button" class="cr-day${currentMonth ? '' : ' is-outside'}${selected}" data-cr-day="${day}" aria-label="${escapeText(label)}"${current}>
      <span class="cr-day-number">${Number(day.slice(-2))}</span>
      <span class="cr-day-marks">${types.map(mark).join('')}</span>
    </button>`)
  }

  container.innerHTML = `<div class="cr-view">
    <header class="cr-page-head"><div><h1>Calendar</h1><p>Select a day to open its journal.</p></div></header>
    <section class="cr-panel cr-calendar" aria-label="Monthly journal calendar">
      <div class="cr-panel-top">
        <div><h2 aria-live="polite">${formatDay(month, {month:'long', year:'numeric'})}</h2>
          <p>${quantity(entryCount, 'entry', 'entries')} across ${quantity(activeDays, 'day')}</p>
        </div>
        <div class="cr-nav">${navButton(icon, 'chevronLeft', 'Previous month', 'prev')}${todayButton('Today')}${navButton(icon, 'chevronRight', 'Next month', 'next')}</div>
      </div>
      <div class="cr-weekdays" aria-hidden="true">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(label => `<span>${label}</span>`).join('')}</div>
      <div class="cr-month-grid">${cells.join('')}</div>
      <div class="cr-key">${Object.entries(categories).map(([key, value]) => `<span>${mark(key)}${value.label}</span>`).join('')}</div>
    </section>
  </div>`

  const changeMonth = (target, focusSelector) => {
    state.month = monthStart(target)
    renderCalendar(container, options)
    refocus(container, focusSelector)
  }
  for (const [action, distance] of [['prev', -1], ['next', 1]]) {
    bind(container, action, () => changeMonth(shiftMonth(month, distance), `[data-cr-act="${action}"]`))
  }
  bind(container, 'today', () => changeMonth(today, `[data-cr-day="${today}"]`))
  const grid = container.querySelector('.cr-month-grid')
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-cr-day]')
    if (button) onDate(button.dataset.crDay)
  })
  grid.addEventListener('keydown', event => {
    const day = event.target.closest('[data-cr-day]')?.dataset.crDay
    if (!day) return
    const delta = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7 }[event.key]
    if (delta === undefined) return
    event.preventDefault()
    const target = shiftDay(day, delta)
    const selector = `[data-cr-day="${target}"]`
    if (monthStart(target) !== month) changeMonth(target, selector)
    else refocus(container, selector)
  })
}

function summarize(records) {
  const workouts = records.filter(record => record.type === 'workout')
  const meals = records.filter(record => record.type === 'meal')
  const prayers = records.filter(record => record.type === 'prayer')
  const weights = records.filter(record => record.type === 'weight' && Number.isFinite(record.kg))
  weights.sort((a, b) => a.date.localeCompare(b.date) || (a.updatedAt || 0) - (b.updatedAt || 0))
  let volume = 0, sets = 0
  for (const workout of workouts) {
    for (const exercise of workout.exercises || []) {
      for (const set of exercise.sets || []) {
        sets++
        volume += (Number(set.kg) || 0) * (Number(set.reps) || 0)
      }
    }
  }
  return {
    workout: workouts.length || null,
    meal: meals.length ? meals.reduce((sum, item) => sum + (Number(item.calories) || 0), 0) : null,
    weight: weights.length ? weights[weights.length - 1].kg : null,
    prayer: prayers.length ? new Set(prayers.map(item => item.date)).size : null,
    weights: weights.length, meals: meals.length, prayers: prayers.length, sets, volume
  }
}

const metrics = {
  workout: { label: 'Workouts', trend: 'Workout sessions' },
  meal: { label: 'Calories logged', trend: 'Calories logged' },
  weight: { label: 'Latest weight', trend: 'Body weight' },
  prayer: { label: 'Prayer days', trend: 'Prayer days' }
}

function metricUnit(type, unit, value) {
  if (type === 'weight') return unit
  if (type === 'meal') return 'kcal'
  if (type === 'prayer') return value === 1 ? 'day' : 'days'
  return value === 1 ? 'session' : 'sessions'
}

function metricValue(type, value, unit) {
  return type === 'weight' ? number.format(mass(value, unit)) : integer.format(value)
}

function metricCard(type, summary, unit, icon) {
  const value = summary[type]
  const metric = metrics[type]
  const detail = {
    workout: summary.sets ? `${quantity(summary.sets, 'set')} · ${number.format(mass(summary.volume, unit))} ${unit} lifted` : 'No sets recorded',
    meal: quantity(summary.meals, 'meal') + ' recorded',
    weight: quantity(summary.weights, 'weigh-in') + ' recorded',
    prayer: quantity(summary.prayers, 'reflection') + ' recorded'
  }[type]
  return `<article class="cr-stat cr-type-${type}">
    <div class="cr-stat-top"><span class="cr-icon">${icon(categories[type].icon, 19)}</span><h3>${metric.label}</h3></div>
    <p class="cr-value">${value === null ? '—' : metricValue(type, value, unit)}${value === null ? '' : ` <small>${metricUnit(type, unit, value)}</small>`}</p>
    <p class="cr-detail">${detail}</p>
  </article>`
}

function periodSeries(records, start, weekly, type) {
  const span = weekly ? 7 : 1
  const count = weekly ? 8 : 7
  return Array.from({ length: count }, (_, i) => {
    const day = shiftDay(start, (i - count + 1) * span)
    const end = shiftDay(day, span - 1)
    const value = summarize(records.filter(record => record.date >= day && record.date <= end))[type]
    return { day, end, value }
  })
}

function trendFigure(points, type, unit, weekly) {
  const available = points.filter(point => point.value !== null)
  if (!available.length) {
    const none = { workout: 'workouts', meal: 'meals', weight: 'weigh-ins', prayer: 'prayers' }[type]
    return `<div class="cr-chart-empty"><strong>No ${none} in this range</strong><p>Your ${weekly ? 'weekly' : 'daily'} trend will appear here as you log entries.</p></div>`
  }

  const values = available.map(point => type === 'weight' ? mass(point.value, unit) : point.value)
  const maximum = Math.max(...values)
  let upper = Math.max(1, Math.ceil(maximum))
  let lower = 0
  if (type === 'weight') {
    const minimum = Math.min(...values)
    const padding = Math.max((maximum - minimum) * 0.15, 0.5)
    upper = Math.ceil(maximum + padding)
    lower = Math.max(0, Math.floor(minimum - padding))
  }
  const axisUnit = metricUnit(type, unit, 2)
  const chartTitle = `${metrics[type].trend}, ${weekly ? 'weekly' : 'daily'} (${axisUnit})`
  const x = index => (index + 0.5) * 600 / points.length
  const y = value => 112 - (value - lower) / (upper - lower) * 101
  const lines = [11, 61.5, 112].map(v => `<line x1="0" x2="600" y1="${v}" y2="${v}" class="cr-guide"/>`).join('')
  const shapes = []
  let previous = null
  for (const [i, point] of points.entries()) {
    if (point.value === null) {
      previous = null
      continue
    }
    const value = type === 'weight' ? mass(point.value, unit) : point.value
    const top = y(value)
    if (type === 'weight') {
      if (previous) shapes.push(`<line x1="${previous.x}" y1="${previous.y}" x2="${x(i)}" y2="${top}" class="cr-segment"/>`)
      shapes.push(`<circle cx="${x(i)}" cy="${top}" r="4.6" class="cr-point"/>`)
      previous = { x:x(i), y:top }
    } else {
      shapes.push(`<rect x="${x(i) - 12}" y="${Math.min(top, 110)}" width="24" height="${Math.max(2, 112 - top)}" rx="3" class="cr-bar"/>`)
    }
  }
  return `<figure class="cr-chart cr-type-${type}" aria-label="${chartTitle}">
    <div class="cr-chart-edge"><span>${number.format(upper)}</span><span>${number.format(lower)}</span></div>
    <svg viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true">${lines}${shapes.join('')}</svg>
    <div class="cr-chart-x" style="--cr-count:${points.length}">${points.map(point => `<span>${formatDay(point.day, weekly ? { month:'numeric', day:'numeric' } : {weekday:'short'})}</span>`).join('')}</div>
    <figcaption>${weekly ? 'Week starting' : 'Day'} · ${axisUnit}${type === 'weight' ? ' · last weigh-in' : ''}</figcaption>
  </figure>
  <details class="cr-data"><summary>View chart data</summary><table><thead><tr><th scope="col">${weekly ? 'Week' : 'Date'}</th><th scope="col">${metrics[type].trend}</th></tr></thead><tbody>${points.map(point => `<tr><th scope="row">${readableRange(point.day, point.end)}</th><td>${point.value === null ? 'No entry' : metricValue(type, point.value, unit) + ' ' + metricUnit(type, unit, point.value)}</td></tr>`).join('')}</tbody></table></details>`
}

function entryRow(entry, index, unit, icon) {
  const category = categories[entry.type]
  let title = category.label
  let description = ''
  if (entry.type === 'workout') {
    title = entry.title || 'Workout'
    description = quantity(entry.exercises?.length || 0, 'exercise')
  } else if (entry.type === 'meal') {
    title = entry.mealType || 'Meal'
    description = integer.format(Number(entry.calories) || 0) + ' kcal'
  } else if (entry.type === 'weight') {
    title = number.format(mass(entry.kg, unit)) + ' ' + unit
    description = 'Weigh-in'
  } else {
    title = 'SOAP prayer'
    description = entry.scripture || entry.prayer || 'Reflection'
  }
  return `<button type="button" data-cr-entry="${index}" class="cr-entry cr-type-${entry.type}">
    <span class="cr-icon">${icon(category.icon, 17)}</span>
    <span class="cr-entry-text"><strong>${escapeText(title)}</strong><small>${escapeText(description)}</small></span>
    <span class="cr-entry-date">${formatDay(entry.date, {month:'short', day:'numeric'})}</span>${icon('chevronRight', 16)}
  </button>`
}

export function renderReports(container, options) {
  const { records, date, unit, onDate, onEdit, icon } = options
  let state = reportState.get(container)
  if (!state || state.date !== date) {
    state = { date, focus:date, period:'weekly', metric:'workout' }
    reportState.set(container, state)
  }
  const weekly = state.period === 'weekly'
  const start = weekly ? startOfWeek(state.focus) : state.focus
  const end = weekly ? shiftDay(start, 6) : start
  const entries = records.filter(record => Object.hasOwn(categories, record.type) && record.date >= start && record.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || 0) - (a.updatedAt || 0))
  const summary = summarize(entries)
  const points = periodSeries(records, start, weekly, state.metric)
  const period = weekly ? 'week' : 'day'

  container.innerHTML = `<div class="cr-view">
    <header class="cr-page-head"><div><h1>Reports</h1><p>Review your training, nutrition, weight, and prayer.</p></div>
      <div class="cr-toggle" role="group" aria-label="Report period">${['daily','weekly'].map(mode => `<button type="button" data-cr-act="${mode}" aria-pressed="${state.period === mode}">${mode === 'daily' ? 'Daily' : 'Weekly'}</button>`).join('')}</div>
    </header>
    <section aria-label="Report summary">
      <div class="cr-period"><h2 aria-live="polite">${readableRange(start, end)}</h2>
        <div class="cr-nav">${navButton(icon,'chevronLeft','Previous ' + period,'prev')}${todayButton(weekly ? 'This week' : 'Today')}${navButton(icon,'chevronRight','Next ' + period,'next')}</div>
      </div>
      <div class="cr-stats">${Object.keys(metrics).map(type => metricCard(type, summary, unit, icon)).join('')}</div>
    </section>
    <section class="cr-panel cr-trends">
      <div class="cr-panel-top"><div><h2>Trends</h2><p>${weekly ? 'Eight weeks through ' : 'Seven days through '}${formatDay(end, {month:'short', day:'numeric', year:'numeric'})}</p></div>
        <select class="cr-select" data-cr-metric aria-label="Trend metric">${Object.entries(metrics).map(([key,m]) => `<option value="${key}"${state.metric === key ? ' selected' : ''}>${m.trend}</option>`).join('')}</select>
      </div>${trendFigure(points, state.metric, unit, weekly)}
    </section>
    <section class="cr-panel cr-entries"><div class="cr-panel-top"><h2>Journal entries</h2><span class="cr-tally">${quantity(entries.length, 'entry', 'entries')}</span></div>
      ${entries.length ? `<div class="cr-entries-list">${entries.map((entry, i) => entryRow(entry, i, unit, icon)).join('')}</div>` :
        `<div class="cr-list-empty"><p>No entries for this ${period}.</p><button type="button" class="cr-journal-link" data-cr-act="journal">Open daily journal ${icon('arrowRight', 16)}</button></div>`}
    </section>
  </div>`

  const update = selector => {
    renderReports(container, options)
    refocus(container, selector)
  }
  for (const mode of ['daily','weekly']) {
    bind(container, mode, () => {
      state.period = mode
      update(`[data-cr-act="${mode}"]`)
    })
  }
  for (const [action, direction] of [['prev',-1], ['next',1], ['today',0]]) {
    bind(container, action, () => {
      state.focus = direction ? shiftDay(state.focus, direction * (weekly ? 7 : 1)) : localDay(new Date())
      update(`[data-cr-act="${action}"]`)
    })
  }
  container.querySelector('[data-cr-metric]').addEventListener('change', event => {
    state.metric = event.target.value
    update('[data-cr-metric]')
  })
  bind(container, 'journal', () => onDate(state.focus))
  container.querySelector('.cr-entries-list')?.addEventListener('click', event => {
    const button = event.target.closest('[data-cr-entry]')
    if (button) onEdit(entries[Number(button.dataset.crEntry)])
  })
}
