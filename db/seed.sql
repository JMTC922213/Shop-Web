INSERT INTO categories (catid, name) VALUES
  (1, 'Laptops'),
  (2, 'Smartphones'),
  (3, 'Audio'),
  (4, 'Accessories');

INSERT INTO products (pid, catid, name, price, description, image_large, image_thumb) VALUES
  (1, 1, 'UltraBook Pro 15', 1299.99, 'High-performance ultrabook with premium build and long battery life.', 'images/laptop-1-full.jpg', 'images/laptop-1.jpg'),
  (4, 1, 'Tablet Plus 12', 599.99, '12-inch productivity tablet with sharp display and stylus support.', 'images/tablet-1.jpg', 'images/tablet-1.jpg'),
  (2, 2, 'SmartPhone X Pro', 899.99, 'Flagship smartphone with advanced camera system and fast charging.', 'images/phone-1.jpg', 'images/phone-1.jpg'),
  (5, 4, 'SmartWatch Series 5', 399.99, 'Fitness-focused smartwatch with heart-rate tracking and notifications.', 'images/smartwatch-1.jpg', 'images/smartwatch-1.jpg'),
  (3, 3, 'Wireless Headphones Elite', 249.99, 'Noise-cancelling wireless headphones with rich sound and comfort fit.', 'images/headphones-1.jpg', 'images/headphones-1.jpg'),
  (6, 4, 'Digital Camera 4K', 799.99, 'Compact 4K camera for travel and creator-focused video recording.', 'images/camera-1.jpg', 'images/camera-1.jpg'),
  (7, 3, 'Bluetooth Speaker Max', 149.99, 'Portable Bluetooth speaker with deep bass and all-day battery.', 'images/speaker-1.jpg', 'images/speaker-1.jpg'),
  (8, 4, 'Mechanical Keyboard RGB', 129.99, 'Mechanical keyboard with RGB lighting and responsive key switches.', 'images/keyboard-1.jpg', 'images/keyboard-1.jpg');
