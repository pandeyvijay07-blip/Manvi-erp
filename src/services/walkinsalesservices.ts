import { supabase } from "../lib/supabase";

export interface CartItem {
  productId: string;
  quantity: number;
  rate: number;
}

export async function saveWalkInSale(
  cart: CartItem[],
  paymentMethod: string
) {
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.quantity * item.rate,
    0
  );

  const saleNo = `WS-${Date.now()}`;

  // Create sale
  const { data: sale, error } = await supabase
    .from("walk_in_sales")
    .insert({
      sale_no: saleNo,
      payment_method: paymentMethod,
      total_amount: totalAmount,
    })
    .select()
    .single();

  if (error) throw error;

  // Save each item and reduce stock
  for (const item of cart) {
    const amount = item.quantity * item.rate;

    await supabase.from("walk_in_sale_items").insert({
      sale_id: sale.id,
      product_id: item.productId,
      quantity: item.quantity,
      rate: item.rate,
      amount,
    });

    const { data: product } = await supabase
      .from("products")
      .select("stock")
      .eq("id", item.productId)
      .single();

    if (!product) continue;

    await supabase
      .from("products")
      .update({
        stock: product.stock - item.quantity,
      })
      .eq("id", item.productId);
  }

  return sale;
}
