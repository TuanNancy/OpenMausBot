import { useEffect, useState } from "react";
import { Merge } from "lucide-react";
import { t } from "@/lib/i18n";
import { setPlacesTogether, setTogetherCommands, togetherNoticeDone, togetherNoticeShown, usePlacesTogether } from "@/lib/places-together";
import { NoticeCard, PRIMARY_BUTTON } from "./NoticeCard";
import { Switch } from "./SettingsPrimitives";

/** The one-time notice of "This computer and My Cloud together" being on by default (electron/places-together.mjs): a
 * card in the corner, like every other notice, that never takes focus or waits for an answer. Drawing it is what turns the
 * default on (main does nothing before). Its first switch turns the joining off at once (back to two separate lists); its
 * second is "Let My Cloud's bots run commands on this computer", as the person has it now, never turned on for them. Got
 * it, the close button, Escape or either switch, and it never shows again. */
export function TogetherNotice({ onClose }: { onClose: () => void }) {
  const together = usePlacesTogether();
  // Told once per notice on screen (a kept object, not a ref: notices are also drawn outside a live tree in tests).
  const [told] = useState(() => ({ current: false }));
  // What the notice found when it was drawn: the person sees the commands switch as it was, and as they then turn it.
  const [commands, setCommands] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"list" | "commands" | null>(null);
  const [failed, setFailed] = useState(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (told.current) return;
    told.current = true;
    void togetherNoticeShown();
  }, []);
  useEffect(() => { if (commands === null && typeof together?.commands === "boolean") setCommands(together.commands); }, [together?.commands, commands]);
  // Until the person turns it, the notice's own drawing is turning it on: never shown off for the moment main takes.
  const on = touched ? together?.on === true : together?.on !== false || together?.notice === true;
  const done = () => { togetherNoticeDone(); onClose(); };
  const turnList = () => {
    if (busy) return;
    setBusy("list"); setFailed(false); setTouched(true);
    togetherNoticeDone();
    void setPlacesTogether(!on, "notice").catch(() => setFailed(true)).finally(() => setBusy(null));
  };
  const turnCommands = () => {
    if (busy) return;
    const next = !(commands ?? false);
    setBusy("commands"); setFailed(false);
    togetherNoticeDone();
    void setTogetherCommands(next).then(setCommands, () => setFailed(true)).finally(() => setBusy(null));
  };
  return <NoticeCard titleId="together-notice-title" notice="together-default" icon={Merge} title={t("together.notice.title")} onDismiss={done}>
    <p className="mb-3 mt-1 text-[13px] text-ink-secondary">{t("together.notice.body")}</p>
    <div className="mb-3 flex flex-col gap-2.5">
      <label className="flex items-center justify-between gap-3 text-[13px] text-ink">
        <span id="together-notice-list">{t("together.notice.list")}</span>
        <Switch data-together-notice-list checked={on} disabled={busy !== null} aria-labelledby="together-notice-list" onClick={turnList} />
      </label>
      {on && <div className="flex flex-col gap-1">
        <label className="flex items-center justify-between gap-3 text-[13px] text-ink">
          <span id="together-notice-commands">{t("together.notice.commands")}</span>
          <Switch data-together-notice-commands checked={commands === true} disabled={busy !== null || commands === null} aria-labelledby="together-notice-commands" onClick={turnCommands} />
        </label>
        <p className="text-[12px] leading-snug text-ink-secondary">{t(commands ? "together.notice.commandsOn" : "together.notice.commandsOff")}</p>
      </div>}
      {!on && <p data-together-notice-off className="text-[12px] leading-snug text-ink-secondary">{t("together.notice.off")}</p>}
    </div>
    {failed && <p role="alert" className="mb-3 text-[12px] text-danger">{t("together.switch.failed")}</p>}
    <button type="button" data-together-notice-done className={PRIMARY_BUTTON} onClick={done}>{t("together.notice.done")}</button>
  </NoticeCard>;
}
