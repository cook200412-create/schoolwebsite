import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SiteHeader } from '@/components/site/site-header';
import { Badge, DataTable, Empty, Stat, money } from '@/components/ui/kit';

describe('responsive layouts', () => {
  const rows = [{ _id: '1', name: 'Rahul Kumar', cls: '8-A' }, { _id: '2', name: 'Ananya Reddy', cls: '8-A' }];
  const cols = [{ key: 'name', label: 'Name' }, { key: 'cls', label: 'Class' }];

  it('renders a table on desktop and stacked cards on mobile (no horizontal scrolling layout)', () => {
    const { container } = render(<DataTable rows={rows} columns={cols} />);
    expect(container.querySelector('table')?.parentElement?.className).toMatch(/hidden.*md:block/);
    const cards = container.querySelector('ul');
    expect(cards?.className).toMatch(/md:hidden/);
    expect(within(cards as HTMLElement).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows an empty state', () => {
    render(<DataTable rows={[]} columns={cols} empty="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('mobile menu opens from the bottom bar "More" event and lists all public links', async () => {
    const { act } = await import('@testing-library/react');
    render(<SiteHeader s={{ schoolName: "Sri Satya Sai Vidyanikethan", shortName: "SSSV" }} />);
    expect(screen.queryByRole('button', { name: /open menu/i })).toBeNull(); // no duplicate hamburger in the header
    act(() => { window.dispatchEvent(new Event('site:menu')); });
    const nav = screen.getByRole('navigation', { name: 'Mobile' });
    for (const label of ['Home', 'About', 'Academics', 'Admissions', 'Facilities', 'Faculty', 'Gallery', 'News', 'Contact']) expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /parent \/ staff login/i }).length).toBeGreaterThan(0);
  });
});

describe('dashboard building blocks', () => {
  it('renders stats, badges and money formatting', () => {
    render(<><Stat label="Collected" value={money(125000)} hint="3 payments" /><Badge tone="green">paid</Badge><Empty>No data</Empty></>);
    expect(screen.getByText('₹1,250')).toBeInTheDocument();
    expect(screen.getByText('3 payments')).toBeInTheDocument();
    expect(screen.getByText('paid')).toBeInTheDocument();
  });
});

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: null }) }));
