const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function buildRepaymentTracker(customers, schedules, ledgerEntries, now = new Date()) {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const customerRows = customers.map((customer) => {
    const customerSchedules = schedules.filter((schedule) => schedule.customerId === customer.id);
    const customerEntries = ledgerEntries.filter((entry) => entry.customerId === customer.id);
    const scheduledTotal = customerSchedules.reduce(
      (total, schedule) => total + Number(schedule.totalAmount ?? 0),
      0
    );
    const creditedTotal = customerEntries
      .filter((entry) => entry.type === 'credit' || entry.amount > 0)
      .reduce((total, entry) => total + Math.max(0, Number(entry.amount || 0)), 0);
    const totalCredit = Math.max(Number(customer.balance || 0), scheduledTotal, creditedTotal);
    const paidAmount = Math.max(0, totalCredit - Number(customer.balance || 0));
    const payments = customerEntries
      .filter((entry) => entry.type === 'payment' || entry.amount < 0)
      .sort((left, right) => (toDate(right.paymentDate ?? right.createdAt)?.getTime() ?? 0) - (toDate(left.paymentDate ?? left.createdAt)?.getTime() ?? 0));
    const activeSchedules = customerSchedules.filter((schedule) => schedule.status === 'active');
    const displayedSchedule = activeSchedules[0] || [...customerSchedules].sort((left, right) =>
      String(right.createdAt ?? right.dueDate ?? '').localeCompare(String(left.createdAt ?? left.dueDate ?? ''))
    )[0] || null;
    const frequency = String(displayedSchedule?.frequency ?? displayedSchedule?.schedule?.frequency ?? 'unknown').toLowerCase();
    const repaymentType = frequency === 'monthly' ? 'Monthly' : frequency === 'weekly' ? 'Weekly' : frequency === 'one_time' ? 'Once' : 'Not set';
    const periodCount = frequency === 'monthly'
      ? Number(displayedSchedule?.totalPayments ?? displayedSchedule?.durationMonths ?? displayedSchedule?.schedule?.durationMonths ?? 0)
      : frequency === 'weekly'
        ? Number(displayedSchedule?.totalPayments ?? displayedSchedule?.durationWeeks ?? displayedSchedule?.schedule?.durationWeeks ?? 0)
        : 1;
    const installmentAmount = Number(displayedSchedule?.installmentAmount)
      || (periodCount > 0 ? Number(displayedSchedule?.totalAmount ?? totalCredit) / periodCount : 0);
    const scheduleId = displayedSchedule?.id;
    const allocatedPayments = scheduleId
      ? payments.filter((payment) => (payment.scheduleAllocations || []).some((allocation) => allocation.scheduleId === scheduleId && Number(allocation.amount) > 0))
      : payments;
    const paidForSchedule = displayedSchedule
      ? Math.max(0, Number(displayedSchedule.totalAmount ?? 0) - Number(displayedSchedule.remainingAmount ?? customer.balance ?? 0))
      : paidAmount;
    const paymentsMade = allocatedPayments.length;
    const periodsRemaining = displayedSchedule
      ? frequency === 'one_time'
        ? (Number(displayedSchedule.remainingAmount ?? customer.balance ?? 0) > 0 ? 1 : 0)
        : Math.max(0, periodCount - paymentsMade)
      : 0;
    const durationMonths = frequency === 'monthly' ? periodCount : 0;
    const durationWeeks = frequency === 'weekly' ? periodCount : 0;
    const lastPaymentDate = payments[0]?.paymentDate ?? payments[0]?.createdAt ?? null;
    const hasOverdueSchedule = activeSchedules.some((schedule) => {
      const dueDate = toDate(schedule.dueDate);
      return dueDate && dueDate < now;
    });
    const status = Number(customer.balance || 0) <= 0
      ? 'Cleared'
      : hasOverdueSchedule || customer.overdue
        ? 'Behind'
        : 'In progress';

    return {
      ...customer,
      totalCredit,
      repaymentType,
      periodCount,
      periodUnit: frequency === 'monthly' ? 'months' : frequency === 'weekly' ? 'weeks' : 'payment',
      installmentAmount,
      paymentsMade,
      periodsRemaining,
      durationMonths,
      durationWeeks,
      monthlyAmount: frequency === 'monthly' ? installmentAmount : 0,
      weeklyAmount: frequency === 'weekly' ? installmentAmount : 0,
      paidAmount,
      outstandingAmount: Number(customer.balance || 0),
      status,
      lastPaymentDate,
      payments,
    };
  });

  const monthlyCollection = ledgerEntries.reduce((total, entry) => {
    if (!(entry.type === 'payment' || entry.amount < 0)) return total;
    const paymentDate = toDate(entry.paymentDate ?? entry.createdAt);
    if (!paymentDate || paymentDate.getMonth() !== currentMonth || paymentDate.getFullYear() !== currentYear) return total;
    return total + Math.abs(Number(entry.amount || 0));
  }, 0);

  return {
    customers: customerRows,
    monthlyCollection,
    outstandingAmount: customerRows.reduce((total, customer) => total + customer.outstandingAmount, 0),
    totalCredit: customerRows.reduce((total, customer) => total + customer.totalCredit, 0),
  };
}