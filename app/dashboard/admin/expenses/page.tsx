
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Edit2,
  ExternalLink,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {DashboardShell} from "@/components/dashboard-shell";

type ExpenseStatus = "pending" | "paid" | "cancelled";
type Frequency = "one_time" | "monthly" | "yearly";

type ExpenseCategory = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type Expense = {
  id: string;
  category_id: string | null;
  category_name: string;
  description: string;
  vendor: string | null;
  amount: number;
  expense_date: string;
  status: ExpenseStatus;
  frequency: Frequency;
  payment_method: string | null;
  invoice_url: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
};

type ExpenseForm = {
  category_id: string;
  description: string;
  vendor: string;
  amount: string;
  expense_date: string;
  status: ExpenseStatus;
  frequency: Frequency;
  payment_method: string;
  invoice_url: string;
  reference_number: string;
  notes: string;
};

const emptyForm: ExpenseForm = {
  category_id: "",
  description: "",
  vendor: "",
  amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
  status: "paid",
  frequency: "one_time",
  payment_method: "UPI",
  invoice_url: "",
  reference_number: "",
  notes: "",
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);

const dateLabel = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [categoryResult, expenseResult] = await Promise.all([
        supabase
          .from("expense_categories")
          .select("id, name, description, is_active")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("business_expenses")
          .select(
            "id, category_id, category_name, description, vendor, amount, expense_date, status, frequency, payment_method, invoice_url, reference_number, notes, created_at"
          )
          .order("expense_date", { ascending: false }),
      ]);

      if (categoryResult.error) throw categoryResult.error;
      if (expenseResult.error) throw expenseResult.error;

      setCategories((categoryResult.data ?? []) as ExpenseCategory[]);
      setExpenses((expenseResult.data ?? []) as Expense[]);
    } catch (err) {
      console.error("Expense load error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not load expenses. Check your database permissions."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const matchesSearch =
        !query ||
        expense.description.toLowerCase().includes(query) ||
        (expense.vendor ?? "").toLowerCase().includes(query) ||
        expense.category_name.toLowerCase().includes(query) ||
        (expense.reference_number ?? "").toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "all" ||
        expense.category_id === categoryFilter;

      const matchesStatus =
        statusFilter === "all" || expense.status === statusFilter;

      const matchesFrom =
        !fromDate || expense.expense_date >= fromDate;

      const matchesTo =
        !toDate || expense.expense_date <= toDate;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    expenses,
    search,
    categoryFilter,
    statusFilter,
    fromDate,
    toDate,
  ]);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const paidTotal = filteredExpenses
    .filter((expense) => expense.status === "paid")
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  const pendingTotal = filteredExpenses
    .filter((expense) => expense.status === "pending")
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  const monthPaidTotal = expenses
    .filter(
      (expense) =>
        expense.status === "paid" &&
        expense.expense_date.startsWith(currentMonth)
    )
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  const paidCount = filteredExpenses.filter(
    (expense) => expense.status === "paid"
  ).length;

  function openAddModal() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      category_id: categories[0]?.id ?? "",
      expense_date: new Date().toISOString().slice(0, 10),
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function openEditModal(expense: Expense) {
    setEditingId(expense.id);
    setForm({
      category_id: expense.category_id ?? "",
      description: expense.description,
      vendor: expense.vendor ?? "",
      amount: String(expense.amount),
      expense_date: expense.expense_date,
      status: expense.status,
      frequency: expense.frequency,
      payment_method: expense.payment_method ?? "UPI",
      invoice_url: expense.invoice_url ?? "",
      reference_number: expense.reference_number ?? "",
      notes: expense.notes ?? "",
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  }

  function updateField<K extends keyof ExpenseForm>(
    key: K,
    value: ExpenseForm[K]
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function saveExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const amount = Number(form.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter an expense amount greater than zero.");
      }

      const category = categories.find(
        (item) => item.id === form.category_id
      );

      if (!category) {
        throw new Error("Please select an expense category.");
      }

      const description = form.description.trim();

      if (!description) {
        throw new Error("Please enter an expense description.");
      }

      if (
        form.invoice_url.trim() &&
        !/^https?:\/\//i.test(form.invoice_url.trim())
      ) {
        throw new Error("Invoice URL must start with http:// or https://.");
      }

      const payload = {
        category_id: category.id,
        category_name: category.name,
        description,
        vendor: form.vendor.trim() || null,
        amount,
        expense_date: form.expense_date,
        status: form.status,
        frequency: form.frequency,
        payment_method: form.payment_method || null,
        invoice_url: form.invoice_url.trim() || null,
        reference_number: form.reference_number.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from("business_expenses")
          .update(payload)
          .eq("id", editingId);

        if (updateError) throw updateError;
        setSuccess("Expense updated successfully.");
      } else {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;
        if (!authData.user) {
          throw new Error("Your session has expired. Please sign in again.");
        }

        const { error: insertError } = await supabase
          .from("business_expenses")
          .insert({
            ...payload,
            created_by: authData.user.id,
          });

        if (insertError) throw insertError;
        setSuccess("Expense added successfully.");
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      console.error("Save expense error:", err);
      setError(
        err instanceof Error ? err.message : "Could not save the expense."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(expense: Expense) {
    const confirmed = window.confirm(
      `Delete "${expense.description}" (${money(Number(expense.amount))})? This cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("business_expenses")
      .delete()
      .eq("id", expense.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSuccess("Expense deleted successfully.");
    await loadData();
  }

  function resetFilters() {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  }

  return (
    <DashboardShell role="admin">
      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Page heading */}
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Receipt className="h-4 w-4" />
                Admin / Finance
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Expense Management
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Track business expenses, payments, and outstanding bills.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add expense
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && !modalOpen && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                className="ml-auto"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{success}</span>
              <button
                type="button"
                onClick={() => setSuccess("")}
                className="ml-auto"
                aria-label="Dismiss success message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Paid expenses"
              value={money(paidTotal)}
              description={`${paidCount} paid record${paidCount === 1 ? "" : "s"} in current view`}
              icon={<CheckCircle2 className="h-5 w-5" />}
              iconClass="bg-emerald-50 text-emerald-700"
            />
            <SummaryCard
              title="Pending payments"
              value={money(pendingTotal)}
              description="Outstanding bills in current view"
              icon={<AlertCircle className="h-5 w-5" />}
              iconClass="bg-amber-50 text-amber-700"
            />
            <SummaryCard
              title="Paid this month"
              value={money(monthPaidTotal)}
              description="All recorded paid expenses this month"
              icon={<CalendarDays className="h-5 w-5" />}
              iconClass="bg-blue-50 text-blue-700"
            />
            <SummaryCard
              title="Records"
              value={String(filteredExpenses.length)}
              description="Expenses matching your filters"
              icon={<CircleDollarSign className="h-5 w-5" />}
              iconClass="bg-violet-50 text-violet-700"
            />
          </div>

          {/* Filters */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-900">Expense records</h2>
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Clear filters
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search description, vendor, reference..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    From date
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    To date
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(event) => setToDate(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Expense table */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading expenses...
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <Receipt className="h-7 w-7" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">
                  No expenses found
                </h3>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  Add your first expense or change the filters to see records.
                </p>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Add your first expense
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-4 font-semibold">Expense</th>
                        <th className="px-5 py-4 font-semibold">Category</th>
                        <th className="px-5 py-4 font-semibold">Date</th>
                        <th className="px-5 py-4 font-semibold">Frequency</th>
                        <th className="px-5 py-4 text-right font-semibold">Amount</th>
                        <th className="px-5 py-4 font-semibold">Status</th>
                        <th className="px-5 py-4 font-semibold">Invoice</th>
                        <th className="px-5 py-4 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredExpenses.map((expense) => (
                        <tr
                          key={expense.id}
                          className="transition hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4">
                            <p className="max-w-xs truncate font-semibold text-slate-900">
                              {expense.description}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {expense.vendor || "No vendor specified"}
                            </p>
                            {expense.reference_number && (
                              <p className="mt-1 text-xs text-slate-400">
                                Ref: {expense.reference_number}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700">
                              {expense.category_name}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                            {dateLabel(expense.expense_date)}
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {expense.frequency === "one_time"
                              ? "One-time"
                              : expense.frequency === "monthly"
                                ? "Monthly"
                                : "Yearly"}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums text-slate-900">
                            {money(Number(expense.amount))}
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={expense.status} />
                          </td>
                          <td className="px-5 py-4">
                            {expense.invoice_url ? (
                              <a
                                href={expense.invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800"
                              >
                                View <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(expense)}
                                title="Edit expense"
                                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteExpense(expense)}
                                title="Delete expense"
                                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-slate-500">
                    Showing {filteredExpenses.length} of {expenses.length} records
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <span className="text-slate-600">
                      Paid: <strong className="text-emerald-700">{money(paidTotal)}</strong>
                    </span>
                    <span className="text-slate-600">
                      Pending: <strong className="text-amber-700">{money(pendingTotal)}</strong>
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>

          <p className="text-xs leading-5 text-slate-500">
            Financial totals are based on the expense records currently saved
            in the database. Mark an expense as paid only after payment is
            completed. Recurring expenses are labels only; this page does not
            automatically create future monthly or yearly records.
          </p>
        </div>
      </div>

      {/* Add/edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setModalOpen(false);
            }
          }}
        >
          <div className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? "Edit expense" : "Add new expense"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Record a business cost for LearnPathshala.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={saveExpense} className="space-y-4 px-5 py-5 sm:px-6">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Description *">
                  <input
                    required
                    maxLength={200}
                    value={form.description}
                    onChange={(event) =>
                      updateField("description", event.target.value)
                    }
                    placeholder="e.g. Supabase Pro subscription"
                    className={fieldClass}
                  />
                </FormField>

                <FormField label="Category *">
                  <select
                    required
                    value={form.category_id}
                    onChange={(event) =>
                      updateField("category_id", event.target.value)
                    }
                    className={fieldClass}
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {categories.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      No active categories found. Check expense_categories in Supabase.
                    </p>
                  )}
                </FormField>

                <FormField label="Amount (₹) *">
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) =>
                      updateField("amount", event.target.value)
                    }
                    placeholder="0.00"
                    className={fieldClass}
                  />
                </FormField>

                <FormField label="Expense date *">
                  <input
                    required
                    type="date"
                    value={form.expense_date}
                    onChange={(event) =>
                      updateField("expense_date", event.target.value)
                    }
                    className={fieldClass}
                  />
                </FormField>

                <FormField label="Vendor / paid to">
                  <input
                    value={form.vendor}
                    maxLength={150}
                    onChange={(event) =>
                      updateField("vendor", event.target.value)
                    }
                    placeholder="e.g. Supabase, teacher name"
                    className={fieldClass}
                  />
                </FormField>

                <FormField label="Payment status *">
                  <select
                    required
                    value={form.status}
                    onChange={(event) =>
                      updateField("status", event.target.value as ExpenseStatus)
                    }
                    className={fieldClass}
                  >
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </FormField>

                <FormField label="Frequency">
                  <select
                    value={form.frequency}
                    onChange={(event) =>
                      updateField("frequency", event.target.value as Frequency)
                    }
                    className={fieldClass}
                  >
                    <option value="one_time">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </FormField>

                <FormField label="Payment method">
                  <select
                    value={form.payment_method}
                    onChange={(event) =>
                      updateField("payment_method", event.target.value)
                    }
                    className={fieldClass}
                  >
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank transfer</option>
                    <option value="Credit Card">Credit card</option>
                    <option value="Debit Card">Debit card</option>
                    <option value="Cash">Cash</option>
                    <option value="Razorpay">Razorpay</option>
                    <option value="PayU">PayU</option>
                    <option value="Other">Other</option>
                  </select>
                </FormField>

                <FormField label="Invoice / receipt URL">
                  <input
                    type="url"
                    value={form.invoice_url}
                    onChange={(event) =>
                      updateField("invoice_url", event.target.value)
                    }
                    placeholder="https://..."
                    className={fieldClass}
                  />
                </FormField>

                <FormField label="Reference number">
                  <input
                    value={form.reference_number}
                    maxLength={120}
                    onChange={(event) =>
                      updateField("reference_number", event.target.value)
                    }
                    placeholder="Transaction or invoice ID"
                    className={fieldClass}
                  />
                </FormField>

                <div className="sm:col-span-2">
                  <FormField label="Notes">
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={form.notes}
                      onChange={(event) =>
                        updateField("notes", event.target.value)
                      }
                      placeholder="Additional details about this expense..."
                      className={fieldClass}
                    />
                  </FormField>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || categories.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Save expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
  iconClass,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div className={`rounded-xl p-3 ${iconClass}`}>{icon}</div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const styles: Record<ExpenseStatus, string> = {
    paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
    cancelled: "bg-slate-100 text-slate-600 ring-slate-500/20",
  };

  const labels: Record<ExpenseStatus, string> = {
    paid: "Paid",
    pending: "Pending",
    cancelled: "Cancelled",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
