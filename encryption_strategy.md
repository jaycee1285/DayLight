# Portable Vault Architecture Decisions

| Area                 | Decision             | Why it fits this project | Wiggle room / fallback if implementation bogs down |
|----------------------|----------------------|----------------------|----------------------|
| Primary model        | Use a **portable     | The goal is          | Start with one vault |
|                      | vault** rather than  | encrypted-at-rest    | directory in a local |
|                      | whole-device trust   | notes that can sync  | app folder. Later,   |
|                      | or a mounted virtual | across phone +       | allow multiple       |
|                      | drive.               | laptops without      | vaults or selected   |
|                      |                      | depending on         | subfolders.          |
|                      |                      | full-device          |                      |
|                      |                      | assumptions. It      |                      |
|                      |                      | matches the          |                      |
|                      |                      | “selected sensitive  |                      |
|                      |                      | corpus” model better |                      |
|                      |                      | than trying to       |                      |
|                      |                      | secure everything.   |                      |
| Scope of vault       | Vault is for         | Keeps the boundary   | If needed later,     |
|                      | **actual notes**,    | clean. Notes need    | allow a second vault |
|                      | not habit-tracking / | privacy;             | class for structured |
|                      | to-do / structured   | pseudo-database      | records, but do not  |
|                      | app-state YAMLs.     | state has different  | force one model onto |
|                      |                      | usage patterns and   | both note content    |
|                      |                      | can stay outside.    | and app-state data.  |
| Encryption boundary  | Use **whole-vault    | A whole-vault model  | If whole-vault UX    |
|                      | encryption           | is easier to reason  | becomes too heavy,   |
|                      | semantics** rather   | about: locked means  | fall back to a       |
|                      | than scattered       | ciphertext-only,     | hybrid where only    |
|                      | encrypted extensions | unlocked means       | one subfolder is     |
|                      | in an otherwise      | controlled access,   | vaulted, but keep    |
|                      | plaintext tree.      | relock means key     | the same             |
|                      |                      | material is dropped. | locked/unlocked      |
|                      |                      |                      | semantics.           |
| Layering             | Split into **two     | This preserves easy  | If two layers become |
|                      | encrypted layers**:  | navigation/search    | too annoying,        |
|                      | catalog layer and    | without decrypting   | collapse to a single |
|                      | content layer.       | note bodies. It      | unlock and keep the  |
|                      |                      | keeps the first      | manifest encrypted   |
|                      |                      | unlock useful        | with content.        |
|                      |                      | without exposing the |                      |
|                      |                      | actual text.         |                      |
| Outer unlock purpose | Outer key unlocks    | Lets the app show    | If even catalog      |
|                      | only a **minimal     | the tree and do      | leakage feels too    |
|                      | catalog manifest**.  | filename/path search | loose, obfuscate     |
|                      |                      | cheaply without full | filenames later or   |
|                      |                      | decrypt. This        | require full unlock  |
|                      |                      | matches your actual  | before showing the   |
|                      |                      | need: “see what      | tree.                |
|                      |                      | exists” before       |                      |
|                      |                      | “read/edit it.”      |                      |
| Outer manifest       | Include only **file  | Minimizes metadata   | Simplest fallback:   |
| contents             | names, logical       | leakage while still  | store just IDs +     |
|                      | paths, stable IDs**, | supporting           | paths. Skip          |
|                      | and optionally       | navigation and basic | timestamps entirely  |
|                      | modified timestamps  | search. Avoids       | if sorting can be    |
|                      | if truly needed.     | turning the catalog  | deferred or computed |
|                      |                      | into a               | later.               |
|                      |                      | secret-content side  |                      |
|                      |                      | channel.             |                      |
| Outer manifest       | Do **not** include   | Prevents metadata    | If a feature         |
| exclusions           | tags, previews,      | creep. The outer     | absolutely needs     |
|                      | backlinks, YAML      | layer should not     | metadata later,      |
|                      | extracts, snippets,  | become “content by   | explicitly mark it   |
|                      | or body-derived      | implication.”        | as content-layer     |
|                      | metadata in the      |                      | only.                |
|                      | first layer.         |                      |                      |
| Inner unlock purpose | Inner key unlocks    | Keeps the sensitive  | If per-file gating   |
|                      | **actual file        | material behind the  | feels too fiddly,    |
|                      | bodies** and editing | real trust boundary. | allow one            |
|                      | capability.          | It matches the       | inner-unlock session |
|                      |                      | “browse first, open  | for a short time     |
|                      |                      | one file at a time”  | window rather than   |
|                      |                      | model.               | prompting on every   |
|                      |                      |                      | file.                |
| Decryption           | Decrypt **one file   | Minimizes plaintext  | For bulk workflows,  |
| granularity          | at a time on         | exposure and keeps   | allow a deliberate   |
|                      | demand** for         | the mental model     | “decrypt selected    |
|                      | reading/editing.     | tight. You only      | set in memory” tool, |
|                      |                      | expose what is       | but make it explicit |
|                      |                      | actively in use.     | and local-only.      |
| Editing model        | Prefer **in-app      | Avoids plaintext     | If external editing  |
|                      | editing or in-memory | leaks through        | is needed later,     |
|                      | file ops** over      | autosave, temp       | make it a clearly    |
|                      | tmpfiles and         | directories,         | weaker desktop-only  |
|                      | external editor      | backups, and         | mode with loud       |
|                      | handoff.             | editor-specific      | warnings and cleanup |
|                      |                      | weirdness. Fits your | logic.               |
|                      |                      | stated preference    |                      |
|                      |                      | exactly.             |                      |
| Temp files           | **No tmpfiles by     | Keeps the            | If a library forces  |
|                      | default.**           | implementation       | disk-backed          |
|                      |                      | honest. Prevents     | behavior, isolate it |
|                      |                      | accidental plaintext | behind an explicit   |
|                      |                      | residue from         | “unsafe convenience  |
|                      |                      | becoming part of the | mode” and document   |
|                      |                      | attack surface.      | the tradeoff.        |
| KDF choice           | Use **Argon2id** for | It fits the learning | If Argon2 tuning     |
|                      | password-based       | goal and gives you   | becomes painful      |
|                      | unlock.              | direct experience    | cross-platform,      |
|                      |                      | with memory/time     | start with           |
|                      |                      | tradeoffs, unlock    | conservative         |
|                      |                      | latency, and session | settings and revisit |
|                      |                      | design.              | once the vault flow  |
|                      |                      |                      | works.               |
| Key structure        | Treat catalog and    | Keeps the two-layer  | If managing two      |
|                      | content as           | model real rather    | independent paths is |
|                      | **separate encrypted | than cosmetic.       | too much for v1,     |
|                      | domains with         | Breaking catalog     | derive one master    |
|                      | separate             | access should not    | key first and split  |
|                      | derived/unwrapped    | imply content        | into subkeys in a    |
|                      | keys**.              | access.              | documented way.      |
| Password model       | Use two conceptual   | This supports the    | If two passwords are |
|                      | unlocks: **catalog   | real UX you wanted:  | too much friction,   |
|                      | unlock** and         | easy browse,         | allow one password   |
|                      | **content unlock**.  | stronger gate for    | with two derived     |
|                      |                      | actual body access.  | domains, but keep    |
|                      |                      |                      | the data domains     |
|                      |                      |                      | separate.            |
| Session behavior     | Content unlock       | Best balance between | Fallback options:    |
|                      | should be            | usability and        | (1) one unlock per   |
|                      | **session-based with | exposure. You can    | file, safer but      |
|                      | idle timeout**, not  | browse easily,       | annoying; (2) one    |
|                      | permanent and not    | unlock content when  | unlock until app     |
|                      | necessarily per-file | needed, and          | close, easier but    |
|                      | prompt spam.         | auto-drop the key    | looser.              |
|                      |                      | after inactivity.    |                      |
| Lock semantics       | “Locked” must mean   | Prevents the lock    | If full zeroization  |
|                      | **no content key in  | button from becoming | is hard in some UI   |
|                      | memory** and no      | theater. The app     | components, at       |
|                      | accessible plaintext | state should reflect | minimum clear        |
|                      | buffers beyond       | a real security      | caches, drop keys,   |
|                      | active UI state.     | state transition.    | and invalidate       |
|                      |                      |                      | content views.       |
| Public header        | Keep a tiny          | This is enough to    | If header evolution  |
|                      | unencrypted header   | know how to unlock   | becomes messy,       |
|                      | with only **format   | the vault without    | version it           |
|                      | version, salts,      | leaking anything     | aggressively and     |
|                      | Argon2 params, and   | interesting about    | keep migration code  |
|                      | cipher               | the contents.        | simple.              |
|                      | identifiers**.       |                      |                      |
| Catalog storage      | Store the catalog as | Hundreds of notes is | If rewrites become   |
|                      | **one encrypted      | small enough that a  | annoying, later      |
|                      | manifest** in v1.    | single manifest is   | split into root      |
|                      |                      | operationally simple | manifest +           |
|                      |                      | and easy to inspect. | per-folder or        |
|                      |                      |                      | per-file sidecars.   |
| Content storage      | Store content as     | Makes one-at-a-time  | If blob indirection  |
|                      | **separate encrypted | decrypt natural and  | is annoying, start   |
|                      | blobs/files per      | avoids rewriting the | with one encrypted   |
|                      | note**.              | whole vault for one  | file per logical     |
|                      |                      | note edit.           | note path and add    |
|                      |                      |                      | IDs later.           |
| Filename privacy     | Accept that          | This is a conscious  | Later add optional   |
|                      | **visible            | tradeoff, not an     | opaque filenames,    |
|                      | filenames/paths are  | accident. It keeps   | folder aliases, or   |
|                      | a deliberate         | navigation sane and  | “private folders”    |
|                      | metadata leak** in   | avoids premature     | with stricter        |
|                      | v1.                  | complexity.          | concealment.         |
| Search               | Support              | Matches the minimal  | Full-text or         |
|                      | **filename/path      | outer manifest and   | semantic search can  |
|                      | search only** at the | avoids decrypting    | be added later as a  |
|                      | catalog layer.       | content just to      | content-unlocked,    |
|                      |                      | navigate.            | in-memory-only       |
|                      |                      |                      | feature.             |
| Visualization /      | For graphs, stats,   | Lets you learn from  | If memory-only       |
| analysis             | or experiments, do   | the data model       | workflows are        |
|                      | **deliberate local   | without permanently  | awkward, support a   |
|                      | bulk decrypt in      | bloating the vault   | throwaway explicit   |
|                      | memory only**.       | or weakening the     | export path, but     |
|                      |                      | default boundary.    | keep it outside      |
|                      |                      |                      | normal operation.    |
| Threat model         | Optimize for         | Keeps the project    | If later threat      |
|                      | **encrypted at rest  | proportionate. The   | needs grow, add      |
|                      | on a small           | vault improves a     | stronger re-auth,    |
|                      | Syncthing-based      | real boundary        | platform keystore    |
|                      | personal device      | without pretending   | integration, or      |
|                      | set**, not for       | to fix an            | stricter filename    |
|                      | “solve all           | already-unlocked     | concealment.         |
|                      | live-device          | session.             |                      |
|                      | compromise.”         |                      |                      |
| Security posture     | Treat this as a      | Keeps expectations   | If the primitive     |
|                      | **serious learning   | honest while still   | proves solid, later  |
|                      | object and reusable  | producing something  | wrap it in stricter  |
|                      | primitive**, not a   | valuable and         | audit/logging/platform-specific |
|                      | compliance-ready     | transferable.        | hardening.           |
|                      | product.             |                      |                      |
| Engineering priority | Prioritize **clean   | This project’s value | If the UI toolkit    |
|                      | boundaries and       | is in understanding  | fights you, cut      |
|                      | inspectable state    | what each layer      | features before      |
|                      | transitions** over   | reveals, stores, and | loosening the        |
|                      | feature breadth.     | drops.               | security model.      |
| UI/API risk          | Assume hostile or    | You already know     | Keep vault state in  |
|                      | awkward GUI APIs may | some toolkits make   | a narrow core module |
|                      | force weird polling, | correct behavior     | with a small         |
|                      | caching, or          | harder than it       | interface. Let the   |
|                      | lifecycle            | should be. Design    | UI be dumb, even if  |
|                      | compromises.         | around that reality  | it means fewer       |
|                      |                      | early.               | niceties in v1.      |
| Core fallback        | Every added step     | Prevents crypto      | When in doubt,       |
| principle            | must justify itself  | theater and keeps    | remove convenience   |
|                      | by **improving a     | the implementation   | or remove            |
|                      | real boundary**, not | aligned with your    | complexity, but do   |
|                      | by sounding          | actual goals.        | not keep decorative  |
|                      | security-ish.        |                      | security layers.     |

# Vault v1: Minimum Honest Implementation

| Component        | v1 choice            | Notes                |
|------------------|----------------------|----------------------|
| Header           | Unencrypted          | Version, salts,      |
|                  |                      | Argon2 params only.  |
| Catalog          | Encrypted            | Names, paths, stable |
|                  |                      | IDs only.            |
| Content          | Encrypted separately | One file/blob per    |
|                  |                      | note body.           |
| Unlock 1         | Catalog password     | Browse tree and      |
|                  |                      | search filenames.    |
| Unlock 2         | Content password     | Read/edit note       |
|                  |                      | bodies.              |
| Editing          | In-app / memory-only | No tmpfiles by       |
|                  |                      | default.             |
| Search           | Filename/path only   | Full-text later,     |
|                  |                      | content-unlocked     |
|                  |                      | only.                |
| Locking          | Idle timeout         | Drop content key and |
|                  |                      | clear caches.        |
| Export/analysis  | Explicit, local,     | Memory-only where    |
|                  | temporary            | possible.            |
| Filename privacy | Visible in v1        | Revisit later for    |
|                  |                      | opaque names.        |
