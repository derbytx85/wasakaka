#!/bin/bash
# Reintento secuencial de imágenes faltantes
cd /home/z/my-project

gen() {
  local prompt="$1"; local out="$2"; local size="$3"
  for i in 1 2 3; do
    if z-ai image -p "$prompt" -o "$out" -s "$size"; then return 0; fi
    echo "reintento $i para $out"; sleep 6
  done
  return 1
}

gen "Warm welcoming photograph of a Latin kitchen table full of homemade Mexican sweet bread, conchas, empanadas and flan on rustic wood, soft morning light, cozy neighborhood feeling, terracotta and cream tones, professional food photography, high quality" "./public/img/hero.png" "1152x864"
sleep 4
gen "Professional food photography of homemade flan with golden caramel sauce on small ceramic plates, Latin dessert, warm natural light, high quality, appetizing" "./public/img/flan.png" "1024x1024"
sleep 4
gen "Professional food photography of golden baked pineapple empanadas with sugar dusting on rustic wooden board, warm natural light, high quality, appetizing" "./public/img/empanadas.png" "1024x1024"
sleep 4
gen "Professional food photography of pickled jalapeños and carrots in glass jar, homemade canned conservas, vibrant colors, warm natural light, high quality" "./public/img/encurtidos.png" "1024x1024"

echo "RETRY_DONE"
