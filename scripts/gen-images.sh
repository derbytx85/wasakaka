#!/bin/bash
# Generación de assets para Wasakaka - logos, hero y fotos de platos
cd /home/z/my-project

# Logo / icono PWA (fondo naranja cálido, sin texto)
z-ai image -p "Flat vector app icon: a friendly smiling steaming homemade bread bowl with a small heart, warm terracotta orange solid background, cream and golden yellow accents, rounded cute minimal style, centered, no text, app icon design, high quality" -o ./public/icons/icon-512.png -s 1024x1024 &
P1=$!

# Hero principal
z-ai image -p "Warm welcoming hero photograph of a Latin grandmother's kitchen table full of homemade Mexican sweet bread, conchas, empanadas and flan on rustic wood, soft morning light, cozy neighborhood feeling, terracotta and cream tones, professional food photography, high quality" -o ./public/img/hero.png -s 1440x720 &
P2=$!
wait $P1 $P2

# Platos (fotos de catálogo)
z-ai image -p "Professional food photography of traditional Mexican conchas sweet bread, golden and pink sugar crust, on rustic ceramic plate, warm natural light, top view, high quality, appetizing" -o ./public/img/conchas.png -s 1024x1024 &
P3=$!
z-ai image -p "Professional food photography of a slice of moist pastel tres leches cake with whipped cream topping and cinnamon dusting on a white plate, warm natural light, high quality, appetizing" -o ./public/img/tres-leches.png -s 1024x1024 &
P4=$!
z-ai image -p "Professional food photography of homemade flan with golden caramel sauce on small ceramic plates, Latin dessert, warm natural light, high quality, appetizing" -o ./public/img/flan.png -s 1024x1024 &
P5=$!
wait $P3 $P4 $P5

z-ai image -p "Professional food photography of homemade piloncillo cinnamon cookies stacked on parchment paper, rustic style, warm natural light, high quality, appetizing" -o ./public/img/galletas.png -s 1024x1024 &
P6=$!
z-ai image -p "Professional food photography of golden baked pineapple empanadas with sugar dusting on rustic wooden board, warm natural light, high quality, appetizing" -o ./public/img/empanadas.png -s 1024x1024 &
P7=$!
z-ai image -p "Professional food photography of buñuelos crispy Mexican fritters with cinnamon sugar and syrup drizzle on colorful ceramic plate, warm natural light, high quality, appetizing" -o ./public/img/bunuelos.png -s 1024x1024 &
P8=$!
wait $P6 $P7 $P8

z-ai image -p "Professional food photography of cheese and poblano pepper tamales unwrapped from corn husks on rustic plate, steaming, warm natural light, high quality, appetizing" -o ./public/img/tamales.png -s 1024x1024 &
P9=$!
z-ai image -p "Professional food photography of Mexican café de olla, clay mug with cinnamon sticks, steam rising, rustic kitchen background, warm natural light, high quality" -o ./public/img/cafecito.png -s 1024x1024 &
P10=$!
z-ai image -p "Professional food photography of pickled jalapeños and carrots in glass jar, homemade canned conservas, vibrant colors, warm natural light, high quality" -o ./public/img/encurtidos.png -s 1024x1024 &
P11=$!
wait $P9 $P10 $P11

echo "ALL_IMAGES_DONE"
