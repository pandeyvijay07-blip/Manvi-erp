import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Product = {
  id: string;
  name: string;
  brand: string;
};

function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");

  async function loadProducts() {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("name");

    setProducts((data as Product[]) || []);
  }

  async function addProduct() {
    if (!name) return;

    await supabase.from("products").insert({
      name,
      brand,
    });

    setName("");
    setBrand("");

    loadProducts();
  }

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Products</h1>

      <input
        placeholder="Product Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <br /><br />

      <input
        placeholder="Brand"
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
      />

      <br /><br />

      <button onClick={addProduct}>
        Add Product
      </button>

      <hr />

      {products.map((product) => (
        <div key={product.id}>
          <strong>{product.name}</strong>
          <br />
          {product.brand}
          <hr />
        </div>
      ))}
    </div>
  );
}

export default Products;
