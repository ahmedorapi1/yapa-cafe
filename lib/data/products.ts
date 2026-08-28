import type { Category, Product } from "@/types";

export const categories: Array<{
  id: Category;
  label: string;
  eyebrow: string;
}> = [
  { id: "hot", label: "مشروبات ساخنة", eyebrow: "Hot Drinks" },
  { id: "fresh", label: "مشروبات فريش", eyebrow: "Fresh Drinks" },
  { id: "cold", label: "مشروبات باردة", eyebrow: "Cold Drinks" },
];

export const products: Product[] = [
  {
    id: "classic-tea",
    name: "Classic Tea",
    category: "hot",
    categoryLabel: "مشروبات ساخنة",
    description: "شاي كلاسيك ساخن بطعم غني وبسيط.",
    price: 45,
    image: "/products/1.png",
    ingredients: ["Black Tea", "Hot Water"],
  },
  {
    id: "turkish-coffee",
    name: "Turkish Coffee",
    category: "hot",
    categoryLabel: "مشروبات ساخنة",
    description: "قهوة تركي بطعم قوي ورائحة غنية.",
    price: 60,
    image: "/products/2.png",
    ingredients: ["Turkish Coffee", "Water"],
  },
  {
    id: "fresh-orange",
    name: "Fresh Orange",
    category: "fresh",
    categoryLabel: "مشروبات فريش",
    description: "عصير برتقال فريش منعش.",
    price: 80,
    image: "/products/3.png",
    ingredients: ["Fresh Orange Juice", "Ice"],
  },
  {
    id: "lemon-mint",
    name: "Lemon Mint",
    category: "fresh",
    categoryLabel: "مشروبات فريش",
    description: "ليمون بالنعناع بطعم فريش ومنعش.",
    price: 75,
    image: "/products/4.png",
    ingredients: ["Fresh Lemon", "Mint", "Ice"],
  },
  {
    id: "iced-spanish-latte",
    name: "Iced Spanish Latte",
    category: "cold",
    categoryLabel: "مشروبات باردة",
    description: "سبانيش لاتيه بارد، كريمي ومتوازن.",
    price: 110,
    image: "/products/5.png",
    ingredients: ["Espresso", "Milk", "Sweetened Milk", "Ice"],
  },
  {
    id: "mangolita",
    name: "Mangolita",
    category: "cold",
    categoryLabel: "مشروبات باردة",
    description: "مكس مانجا وفراولة مع صودا ونعناع ولمسة برتقال.",
    price: 100,
    image: "/products/6.png",
    ingredients: [
      "Mango Juice",
      "Strawberry Juice",
      "Soda",
      "Ice",
      "Mint",
      "Orange Slice",
    ],
  },
];

export const statusCopy = {
  NEW: {
    label: "تم استلام طلبك",
    staffLabel: "جديد",
    detail: "فريق Yapa شاف طلبك وهنبدأ حالاً.",
  },
  PREPARING: {
    label: "طلبك بيتحضّر ☕",
    staffLabel: "قيد التحضير",
    detail: "بنحضّر كل مشروب بعناية مخصوص ليك.",
  },
  READY: {
    label: "طلبك جاهز ✨",
    staffLabel: "جاهز",
    detail: "مشروباتك جاهزة وهتوصلك على الترابيزة.",
  },
  COMPLETED: {
    label: "تم تقديم الطلب",
    staffLabel: "مكتمل",
    detail: "بالهنا والشفا. مستنيين طلبك الجاي.",
  },
  REJECTED: {
    label: "تعذّر تنفيذ الطلب",
    staffLabel: "مرفوض",
    detail: "من فضلك تواصل مع فريق Yapa للمساعدة.",
  },
} as const;
