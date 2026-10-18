-- 005_seed_settings.sql — initial editable website settings (all editable later from /admin/settings)
-- Social links start DISABLED; the administrator activates them once the real URLs exist.

insert into public.site_settings (key, value)
values (
  'site',
  $json$
{
  "site_name": "هالة شنب للعناية بالشعر",
  "slogan": "استعيدي جمال وقوة شعرك مع هالة شنب.",
  "logo_path": null,
  "hero_image_path": null,
  "hero_headline": "هالة شنب للعناية بالشعر",
  "hero_intro": "أهلًا بكِ في الموقع الرسمي لهالة شنب للعناية بالشعر. هنا تتعرّفين على حكاية هالة وخبرتها في جلسات التريتمنت والترطيب والترميم والعناية بالشعر المجهد، وتتابعين أحدث المقالات والصور والفيديوهات، وتتواصلين معها بسهولة.",
  "phone": "01117723485",
  "address": "كوتسيكا - المعادي - شارع الست شتيا - أمام نفق كوتسيكا - بجوار ورشة الحاج مصباح للخراطة",
  "social": {
    "facebook":  { "url": "", "enabled": false },
    "instagram": { "url": "", "enabled": false },
    "whatsapp":  { "url": "", "phone": "01117723485", "enabled": false }
  },
  "social_order": ["facebook", "instagram", "whatsapp"],
  "footer_text": "جميع الحقوق محفوظة لـ هالة شنب للعناية بالشعر.",
  "seo_title": "هالة شنب للعناية بالشعر",
  "seo_description": "استعيدي جمال وقوة شعرك مع هالة شنب. جلسات تريتمنت وترطيب وترميم وعناية بالشعر المجهد في كوتسيكا - المعادي.",
  "accent": "gold",
  "sections": [
    { "id": "story",    "title": "ما لا تعرفه عن هالة شنب", "description": "حكاية طموح بدأ منذ الطفولة، وكبر بالإصرار، وما زال يسعى إلى تحقيق الحلم", "visible": true },
    { "id": "services", "title": "العناية بالشعر والتريتمنت", "description": "خدمات تبدأ بفهم حالة شعرك واحتياجاته، لا بالتعامل مع كل الحالات بالطريقة نفسها.", "visible": true },
    { "id": "articles", "title": "آخر المقالات والأخبار", "description": "معلومات وأخبار جديدة عن هالة شنب وعالم العناية بالشعر.", "visible": true },
    { "id": "gallery",  "title": "معرض الصور", "description": "لقطات من رحلة هالة وأعمالها.", "visible": true },
    { "id": "videos",   "title": "معرض الفيديو", "description": "شاهدي فيديوهات من عالم هالة شنب.", "visible": true },
    { "id": "contact",  "title": "تواصلي معنا", "description": "يسعدنا استقبال استفسارك والإجابة عنه.", "visible": true }
  ],
  "services": [
    { "title": "جلسات التريتمنت", "text": "عناية تتجاوز المظهر الخارجي وتهتم بحالة الشعر واحتياجاته." },
    { "title": "الترطيب والترميم", "text": "اهتمام بملمس الشعر ومظهره وفقًا لطبيعته وما يحتاج إليه." },
    { "title": "العناية بالشعر المجهد", "text": "عناية تناسب الشعر الجاف أو المجهد أو الذي تعرض للتلف نتيجة عوامل مختلفة." },
    { "title": "فهم طبيعة شعرك", "text": "نستمع إلى ما تريدينه ونوضّح لكِ الخيارات التي تناسب شعرك الطبيعي أو المصبوغ." }
  ]
}
$json$::jsonb
)
on conflict (key) do nothing;
