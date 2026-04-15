const crypto = require("node:crypto");

const MERCHANT_EMAIL = process.env.MERCHANT_EMAIL || "admin@techshop.com";
const CURRENCY = "usd";

function computeDigest(currency, merchantEmail, salt, items, total) {
  // Sort items by pid for deterministic ordering
  const sortedItems = items.slice().sort((a, b) => a.pid - b.pid);
  const itemParts = sortedItems.map(
    (item) => `${item.pid}:${item.quantity}:${item.price_at_purchase}`
  );
  const payload = [currency, merchantEmail, salt, ...itemParts, total].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function requireLogin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!req.user.is_admin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function registerWebhookRoute(app, database) {
  const express = require("express");

  app.post(
    "/api/webhook/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!stripeSecretKey || !webhookSecret) {
        return res.status(500).json({ error: "Stripe not configured" });
      }

      const stripe = require("stripe")(stripeSecretKey);
      const sig = req.headers["stripe-signature"];

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).json({ error: "Invalid signature" });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const orderid = session.metadata && session.metadata.orderid;
        const sessionDigest = session.metadata && session.metadata.digest;

        if (!orderid) {
          return res.status(400).json({ error: "Missing order id in metadata" });
        }

        try {
          // Fetch order from DB
          const order = await database.get(
            "SELECT * FROM orders WHERE orderid = ?",
            [orderid]
          );

          if (!order) {
            return res.status(404).json({ error: "Order not found" });
          }

          // Duplicate prevention: check order not already paid
          if (order.status === "paid") {
            return res.json({ received: true, message: "Already processed" });
          }

          // Fetch order items and regenerate digest
          const items = await database.all(
            "SELECT pid, quantity, price_at_purchase FROM order_items WHERE orderid = ?",
            [orderid]
          );

          const regeneratedDigest = computeDigest(
            order.currency,
            order.merchant_email,
            order.salt,
            items,
            order.total
          );

          // Compare digests with timing-safe comparison
          const digestA = Buffer.from(regeneratedDigest, "utf8");
          const digestB = Buffer.from(sessionDigest || "", "utf8");

          if (
            digestA.length !== digestB.length ||
            !crypto.timingSafeEqual(digestA, digestB)
          ) {
            console.error("Digest mismatch for order", orderid);
            return res.status(400).json({ error: "Digest verification failed" });
          }

          // Update order status to paid
          const paymentIntent =
            session.payment_intent || session.payment_intent_id || null;

          await database.run(
            "UPDATE orders SET status = 'paid', stripe_payment_intent = ? WHERE orderid = ?",
            [paymentIntent, orderid]
          );

          return res.json({ received: true });
        } catch (err) {
          console.error("Webhook processing error:", err);
          return res.status(500).json({ error: "Webhook processing failed" });
        }
      }

      res.json({ received: true });
    }
  );
}

function registerCheckoutRoutes(app, database) {
  // POST /api/checkout/create-order
  app.post("/api/checkout/create-order", requireLogin, async (req, res) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    const stripe = require("stripe")(stripeSecretKey);
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    try {
      // Validate each item and fetch current prices from DB
      const orderItems = [];
      for (const item of items) {
        const pid = Number(item.pid);
        const quantity = Number(item.quantity);

        if (!Number.isInteger(pid) || pid < 1) {
          return res.status(400).json({ error: `Invalid product id: ${item.pid}` });
        }
        if (!Number.isInteger(quantity) || quantity < 1) {
          return res
            .status(400)
            .json({ error: `Invalid quantity for product ${pid}` });
        }

        const product = await database.get(
          "SELECT pid, name, price FROM products WHERE pid = ?",
          [pid]
        );
        if (!product) {
          return res.status(400).json({ error: `Product ${pid} not found` });
        }

        orderItems.push({
          pid: product.pid,
          name: product.name,
          quantity,
          price_at_purchase: product.price,
        });
      }

      // Compute total with rounding for float precision
      const total = Math.round(
        orderItems.reduce(
          (sum, item) => sum + item.price_at_purchase * item.quantity,
          0
        ) * 100
      ) / 100;

      // Generate random salt
      const salt = crypto.randomBytes(32).toString("hex");

      // Compute SHA-256 digest
      const digest = computeDigest(CURRENCY, MERCHANT_EMAIL, salt, orderItems, total);

      // Insert order into DB
      const orderResult = await database.run(
        "INSERT INTO orders (userid, currency, merchant_email, salt, digest, total, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
        [req.user.userid, CURRENCY, MERCHANT_EMAIL, salt, digest, total]
      );
      const orderid = orderResult.lastID;

      // Insert order items
      for (const item of orderItems) {
        await database.run(
          "INSERT INTO order_items (orderid, pid, quantity, price_at_purchase) VALUES (?, ?, ?, ?)",
          [orderid, item.pid, item.quantity, item.price_at_purchase]
        );
      }

      // Create Stripe Checkout Session
      const lineItems = orderItems.map((item) => ({
        price_data: {
          currency: CURRENCY,
          product_data: { name: item.name },
          unit_amount: Math.round(item.price_at_purchase * 100),
        },
        quantity: item.quantity,
      }));

      const baseUrl = process.env.BASE_URL || "https://localhost:3000";

      const stripeSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${baseUrl}/index.html?order_success=${orderid}`,
        cancel_url: `${baseUrl}/index.html?order_cancelled=${orderid}`,
        metadata: { orderid: String(orderid), digest },
      });

      // Update order with stripe_session_id
      await database.run(
        "UPDATE orders SET stripe_session_id = ? WHERE orderid = ?",
        [stripeSession.id, orderid]
      );

      res.json({
        orderid,
        digest,
        checkout_url: stripeSession.url,
      });
    } catch (err) {
      console.error("Checkout error:", err);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // GET /api/orders/my — last 5 orders for logged-in user
  app.get("/api/orders/my", requireLogin, async (req, res) => {
    try {
      const orders = await database.all(
        "SELECT orderid, total, status, created_at FROM orders WHERE userid = ? ORDER BY created_at DESC LIMIT 5",
        [req.user.userid]
      );

      // Fetch items for each order
      for (const order of orders) {
        order.items = await database.all(
          `SELECT oi.pid, oi.quantity, oi.price_at_purchase, p.name
           FROM order_items oi
           LEFT JOIN products p ON oi.pid = p.pid
           WHERE oi.orderid = ?`,
          [order.orderid]
        );
      }

      res.json(orders);
    } catch (err) {
      console.error("Error fetching user orders:", err);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // GET /api/admin/orders — all orders for admin
  app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    try {
      const orders = await database.all(
        `SELECT o.orderid, o.userid, o.total, o.status, o.created_at, u.name AS user_name, u.email AS user_email
         FROM orders o
         JOIN users u ON o.userid = u.userid
         ORDER BY o.created_at DESC`
      );

      // Fetch items for each order
      for (const order of orders) {
        order.items = await database.all(
          `SELECT oi.pid, oi.quantity, oi.price_at_purchase, p.name
           FROM order_items oi
           LEFT JOIN products p ON oi.pid = p.pid
           WHERE oi.orderid = ?`,
          [order.orderid]
        );
      }

      res.json(orders);
    } catch (err) {
      console.error("Error fetching admin orders:", err);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });
}

module.exports = { registerWebhookRoute, registerCheckoutRoutes };
