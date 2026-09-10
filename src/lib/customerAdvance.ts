import { supabase } from "./supabase";

export async function getCustomerAdvance(
  customerId: string
) {
  const { data, error } = await supabase
    .from("customer_advances")
    .select(`
      id,
      amount,
      adjusted_amount
    `)
    .eq("customer_id", customerId);

  if (error) {
    throw error;
  }

  return (data || []).reduce(
    (total, row) =>
      total +
      Math.max(
        0,
        Number(row.amount || 0) -
          Number(row.adjusted_amount || 0)
      ),
    0
  );
}


export async function useCustomerAdvance(
  customerId: string,
  amount: number
) {
  if (!customerId || amount <= 0) {
    return {
      used: 0,
      remainingToPay: amount,
    };
  }

  const { data, error } = await supabase
    .from("customer_advances")
    .select(`
      id,
      amount,
      adjusted_amount
    `)
    .eq("customer_id", customerId)
    .order("advance_date", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  let remainingBill = amount;
  let totalUsed = 0;

  for (const advance of data || []) {
    if (remainingBill <= 0) {
      break;
    }

    const available =
      Number(advance.amount || 0) -
      Number(advance.adjusted_amount || 0);

    if (available <= 0) {
      continue;
    }

    const useAmount = Math.min(
      available,
      remainingBill
    );

    const newAdjustedAmount =
      Number(advance.adjusted_amount || 0) +
      useAmount;

    const { error: updateError } =
      await supabase
        .from("customer_advances")
        .update({
          adjusted_amount:
            newAdjustedAmount,
        })
        .eq("id", advance.id);

    if (updateError) {
      throw updateError;
    }

    remainingBill -= useAmount;
    totalUsed += useAmount;
  }

  return {
    used: totalUsed,
    remainingToPay: Math.max(
      0,
      remainingBill
    ),
  };
}