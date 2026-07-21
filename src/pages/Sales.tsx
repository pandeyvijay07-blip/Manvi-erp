async function saveSale() {
  const product = products.find((p) => p.id === productId);

  if (!product || !customerId) return;

  const { data: customerPrice } = await supabase
    .from("customer_prices")
    .select("price")
    .eq("customer_id", customerId)
    .eq("product_id", productId)
    .maybeSingle();

  const rate = customerPrice?.price ?? product.selling_price;

  await supabase.from("sales").insert({
    customer_id: customerId,
    product_id: productId,
    quantity: qty,
    rate: rate,
    total: qty * Number(rate),
    created_at: new Date().toISOString(),
  });

  const { data: stockData } = await supabase
    .from("products")
    .select("stock")
    .eq("id", productId)
    .single();

  await supabase
    .from("products")
    .update({
      stock: Number(stockData?.stock || 0) - qty,
    })
    .eq("id", productId);

  alert("Sale Saved Successfully");

  setCustomerId("");
  setProductId("");
  setQty(1);
}
