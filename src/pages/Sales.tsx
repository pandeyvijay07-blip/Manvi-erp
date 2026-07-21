async function saveSale() {
  const product = products.find((p) => p.id === productId);

  if (!product || !customerId) {
    alert("Please select a customer and product.");
    return;
  }

  // Check for customer-specific price
  const { data: customerPrice } = await supabase
    .from("customer_prices")
    .select("price")
    .eq("customer_id", customerId)
    .eq("product_id", productId)
    .maybeSingle();

  const rate = Number(customerPrice?.price ?? product.selling_price);

  // Save sale
  const { error: saleError } = await supabase.from("sales").insert({
    customer_id: customerId,
    product_id: productId,
    quantity: qty,
    rate,
    total: qty * rate,
    created_at: new Date().toISOString(),
  });

  if (saleError) {
    alert(saleError.message);
    return;
  }

  // Update stock
  const { data: stockData, error: stockError } = await supabase
    .from("products")
    .select("stock")
    .eq("id", productId)
    .single();

  if (!stockError && stockData) {
    await supabase
      .from("products")
      .update({
        stock: Math.max(0, Number(stockData.stock || 0) - qty),
      })
      .eq("id", productId);
  }

  // Reload data
  await loadData();

  // Clear form
  setCustomerId("");
  setProductId("");
  setQty(1);

  alert("Sale Saved Successfully");
}
