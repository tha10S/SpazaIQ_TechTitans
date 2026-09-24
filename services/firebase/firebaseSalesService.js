import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

function uid() {
  if (!auth.currentUser) throw new Error("Not signed in");
  return auth.currentUser.uid;
}

export async function recordSale({ cart, paymentMethod, total }) {
  const ref = await addDoc(collection(db, "users", uid(), "sales"), {
    cart,
    paymentMethod,
    total,
    createdAt: serverTimestamp(),
  });
  return ref.id; // same as the mock, which returns sale.id
}

export async function getSales() {
  const q = query(collection(db, "users", uid(), "sales"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}