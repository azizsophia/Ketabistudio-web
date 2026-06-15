import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser, getAccess } from "@/lib/hifz/access";
import { getHifzSubscriptionByUser } from "@/lib/hifz/subscriptions";
import { signOut } from "../actions";
import ManageButton from "./ManageButton";
import styles from "../hifz.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getUser();
  if (!user) redirect("/hifz/login");

  const access = await getAccess(user.id);
  const sub = await getHifzSubscriptionByUser(user.id);
  const hasCustomer = Boolean(sub?.stripe_customer_id);

  const renewal = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="wrap">
      <div className={styles.page}>
        <Link href="/hifz" className={styles.back}>
          ← Back to the Quran
        </Link>

        <div className={styles.head}>
          <p className={styles.eyebrow}>Ketabi Hifz</p>
          <h1 className={styles.title}>Your account</h1>
        </div>

        <div className={styles.account}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Email</span>
            <span className={styles.statValue} style={{ textTransform: "none" }}>
              {user.email}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Access</span>
            <span className={styles.statValue}>
              {access.subscribed ? "Full Quran" : "Free preview"}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Plan</span>
            <span className={styles.statValue}>{access.plan || "Free"}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Status</span>
            <span className={styles.statValue}>{access.status || "free"}</span>
          </div>
          {renewal && (
            <div className={styles.statRow}>
              <span className={styles.statLabel}>
                {access.status === "canceled" ? "Access until" : "Renews"}
              </span>
              <span className={styles.statValue} style={{ textTransform: "none" }}>
                {renewal}
              </span>
            </div>
          )}

          <div className={styles.accountBtns}>
            <ManageButton hasCustomer={hasCustomer} />
            <form action={signOut}>
              <button type="submit" className="btn btn-outline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
