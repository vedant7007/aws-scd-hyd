'use client'

import { useMemo, useState } from 'react'

export type AttendeeRow = {
  ticketRef: string
  name: string
  email: string
  college: string
  tier: string
  foodPreference: string
  paymentStatus: string
  checkedIn: boolean
  swagIssued: boolean
}

export function AttendeeTable({ rows }: { rows: AttendeeRow[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.ticketRef, r.name, r.email, r.college, r.tier, r.foodPreference].some((f) =>
        f.toLowerCase().includes(q),
      ),
    )
  }, [rows, query])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="attendee-search" className="text-step--1 text-muted">
          Search by name, email, ticket, college or tier
        </label>
        <input
          id="attendee-search"
          type="search"
          className="field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type to filter"
        />
      </div>

      <p role="status" className="text-step--1 text-muted">
        {filtered.length} of {rows.length} shown
      </p>

      {filtered.length === 0 ? (
        <p className="text-muted">Nothing matches that search.</p>
      ) : (
        <div className="scroll-x">
          <table className="data-table">
            <caption className="sr-only">Registered attendees</caption>
            <thead>
              <tr>
                <th scope="col">Ticket</th>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">College</th>
                <th scope="col">Tier</th>
                <th scope="col">Food</th>
                <th scope="col">Status</th>
                <th scope="col">In</th>
                <th scope="col">Swag</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.ticketRef}>
                  <td className="mono">{r.ticketRef}</td>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td>{r.college}</td>
                  <td>{r.tier}</td>
                  <td>{r.foodPreference}</td>
                  <td>{r.paymentStatus}</td>
                  <td>{r.checkedIn ? 'yes' : 'no'}</td>
                  <td>{r.swagIssued ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
