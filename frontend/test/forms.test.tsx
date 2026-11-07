import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplyForm, applicationSchema } from '@/features/admissions/apply-form';
import { LoginForm, loginSchema, passwordSchema, registerSchema } from '@/features/auth/auth-forms';

const api = vi.fn();
const login = vi.fn();
vi.mock('@/lib/client', () => ({ api: (...a: unknown[]) => api(...a), errorMessage: (e: any) => e?.message ?? 'error' }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ login, refresh: vi.fn(), user: null, loading: false, can: () => false }) }));

beforeEach(() => { api.mockReset(); login.mockReset(); });

describe('validation schemas', () => {
  it('enforces the password policy', () => {
    expect(passwordSchema.safeParse('short1A').success).toBe(false);
    expect(passwordSchema.safeParse('alllowercase123').success).toBe(false);
    expect(passwordSchema.safeParse('NoDigitsHereAtAll').success).toBe(false);
    expect(passwordSchema.safeParse('Str0ngPassw0rd!').success).toBe(true);
  });
  it('validates login input', () => {
    expect(loginSchema.safeParse({ email: 'bad', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });
  it('requires matching passwords and consent at registration', () => {
    const base = { name: 'Asha Rao', email: 'a@b.co', password: 'Str0ngPassw0rd!', confirm: 'Str0ngPassw0rd!', consent: true as const };
    expect(registerSchema.safeParse(base).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, confirm: 'different' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, consent: false }).success).toBe(false);
  });
  it('validates admission applications', () => {
    const ok = { firstName: 'A', dob: '2015-01-01', gender: 'male', classApplying: '1', academicYear: '2026-27', guardianName: 'Parent', phone: '9876543210', email: 'p@x.com', consent: true };
    expect(applicationSchema.safeParse(ok).success).toBe(true);
    expect(applicationSchema.safeParse({ ...ok, phone: '12' }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...ok, dob: '2999-01-01' }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...ok, pincode: '12' }).success).toBe(false);
  });
});

describe('login flow', () => {
  it('shows field errors and does not call the API when invalid', async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });
  it('signs in with valid credentials', async () => {
    login.mockResolvedValue({ role: 'parent' });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'parent@demo.school');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('parent@demo.school', 'secret'));
  });
  it('has a show/hide toggle on the password field', async () => {
    render(<LoginForm />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input).toHaveAttribute('type', 'password');
  });
  it('shows the server error for bad credentials', async () => {
    login.mockRejectedValue(new Error('Invalid email or password'));
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});

describe('admission workflow (public form)', () => {
  it('blocks submission until required fields and consent are provided', async () => {
    render(<ApplyForm defaultYear="2026-27" />);
    await userEvent.click(screen.getByRole('button', { name: /submit application/i }));
    expect(await screen.findAllByText(/required/i)).not.toHaveLength(0);
    expect(screen.getByText(/consent is required/i)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it('submits multipart data and shows the application number', async () => {
    api.mockResolvedValue({ applicationNumber: 'APP202600042' });
    render(<ApplyForm defaultYear="2026-27" />);
    const t = (label: RegExp, v: string) => userEvent.type(screen.getByLabelText(label), v);
    await t(/first name/i, 'Asha');
    await userEvent.type(screen.getByLabelText(/date of birth/i), '2015-03-02');
    await t(/class applying/i, '1');
    await userEvent.type(screen.getAllByLabelText(/full name/i)[0], 'Ravi Rao');
    await t(/mobile number/i, '9876543210');
    await t(/^email/i, 'ravi@example.com');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /submit application/i }));
    expect(await screen.findByText('APP202600042')).toBeInTheDocument();
    const [path, opts] = api.mock.calls[0];
    expect(path).toBe('/admissions/applications');
    expect(opts.form).toBeInstanceOf(FormData);
    expect(JSON.parse(opts.form.get('data')).guardian.phone).toBe('9876543210');
  });

  it('rejects oversized or wrong-type documents on the client', async () => {
    render(<ApplyForm />);
    const input = screen.getByLabelText(/birth certificate/i) as HTMLInputElement;
    const exe = new File(['x'], 'a.exe', { type: 'application/x-msdownload' });
    await userEvent.upload(input, exe, { applyAccept: false });
    expect(await screen.findByText(/only pdf, jpg or png/i)).toBeInTheDocument();
  });
});
