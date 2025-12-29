Read-only repo/docs audit on /data/order-processing.

Do:
- print `pwd`, `date -Is`, `whoami`
- print `ls -la /data/order-processing`
- print `find /data/order-processing -maxdepth 2 -type f -printf '%p\t%k KB\n' | sort`
- if git: `git -C /data/order-processing status --porcelain=v1 && git -C /data/order-processing rev-parse HEAD`
- print the first 120 lines of:
  - README.md
  - SOLUTION_DESIGN.md
  - MVP_AND_HOWTO.md
  - CROSS_TENANT_TEAMS_DEPLOYMENT.md
  - WHAT_WE_NEED_TO_KNOW.md
- identify any contradictions between docs, and list them

Print a summary: “What is the agreed architecture and what remains to be built?”
