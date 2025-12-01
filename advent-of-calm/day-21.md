# Day 21: Joining the CALM Community

## Overview
Subscribe to the CALM Monthly Working Group and Weekly Office Hours to connect with the community and stay updated on CALM developments.

## Objective and Rationale
- **Objective:** Join the CALM community meetings to learn from others, share your experiences, and influence the future of CALM
- **Rationale:** Open source projects thrive through community participation. The CALM community holds regular meetings where you can ask questions, share feedback, propose features, and learn about upcoming changes. Your voice matters!

## Requirements

### 1. Understand the CALM Community Structure

The CALM project is part of FINOS (Fintech Open Source Foundation) and has regular community touchpoints:

**Monthly Working Group:**
- Strategic discussions and major decisions
- Feature proposals and roadmap planning
- Community updates and showcases
- Great for sharing your Advent of CALM experience!

**Weekly Office Hours:**
- Informal Q&A sessions
- Technical help and troubleshooting
- Quick feedback on ideas
- Perfect for asking questions about what you've learned

### 2. Access the FINOS Calendar

Visit the FINOS community calendar to find CALM meetings:

**URL:** [http://calendar.finos.org/](http://calendar.finos.org/)

**Steps:**
1. Open the calendar in your browser
2. Search or filter for "CALM" or "Architecture as Code"
3. You'll find entries for:
   - CALM Monthly Working Group
   - CALM Weekly Office Hours

### 3. Subscribe to the Calendar

Add the CALM meetings to your calendar:

**For Google Calendar:**
1. Click on a CALM meeting event
2. Click "Copy to my calendar" or use the iCal link
3. Set up reminders so you don't miss meetings

**For Outlook/Other:**
1. Copy the iCal (.ics) link
2. Add as a subscribed calendar in your calendar app
3. Meetings will sync automatically

### 4. Join the Mailing List

Stay informed between meetings:

**Steps:**
1. Visit the FINOS mailing lists page
2. Subscribe to the Architecture as Code mailing list
3. You'll receive:
   - Meeting announcements
   - Important updates
   - Discussion threads

### 5. Prepare Your Community Introduction

When you join your first meeting, introduce yourself!

**Prompt:**
```text
Help me write a brief introduction for my first CALM community meeting:

Include:
- My name and role
- How I discovered CALM
- That I'm completing the Advent of CALM challenge
- One thing I've learned that I found valuable
- A question I'd like to ask the community
```

### 6. Document Your Participation Plan

**File:** `docs/community-participation.md`

**Prompt:**
```text
Create docs/community-participation.md that documents:

1. CALM Community Meetings:
   - Monthly Working Group: purpose and when it meets
   - Weekly Office Hours: purpose and when it meets
   - Calendar link: http://calendar.finos.org/

2. How to Participate:
   - Subscribe to calendar
   - Join mailing list
   - Attend meetings
   - Ask questions in Slack/Discord

3. My Participation Goals:
   - Attend at least one Monthly Working Group
   - Join Weekly Office Hours to ask questions
   - Share my Advent of CALM experience

4. Questions I Want to Ask:
   - List 2-3 questions from your learning journey
```

### 7. Review What You'd Share

Think about what you could contribute to the community:

**From your Advent of CALM journey:**
- Challenges you faced and how you solved them
- Patterns or Standards that might help others
- Ideas for improving CALM or the documentation
- Your use case for CALM

### 8. Update Your README

```markdown
- [x] Day 21: Join CALM Community - subscribed to meetings and mailing list
```

### 9. Commit Your Work

```bash
git add docs/community-participation.md README.md
git commit -m "Day 21: Document CALM community participation plan"
git tag day-21
```

## Deliverables / Validation Criteria

Your Day 21 submission should include a commit tagged `day-21` containing:

✅ **Required Files:**
- `docs/community-participation.md` - Community participation documentation
- Updated `README.md` - Day 21 marked as complete

✅ **Actions Taken:**
- [ ] Visited http://calendar.finos.org/
- [ ] Found CALM meetings on the calendar
- [ ] Subscribed to at least one meeting series
- [ ] Prepared an introduction for your first meeting

✅ **Validation:**
```bash
# Documentation exists
test -f docs/community-participation.md

# Check tag
git tag | grep -q "day-21"
```

## Resources

- [FINOS Calendar](http://calendar.finos.org/)
- [FINOS Architecture as Code Project](https://github.com/finos/architecture-as-code)
- [FINOS Community Guidelines](https://community.finos.org/)
- [CALM GitHub Discussions](https://github.com/finos/architecture-as-code/discussions)

## Tips

- Don't be shy! The community is welcoming and loves new participants
- Prepare questions in advance - write them down
- Share your screen if you want to show something you've built
- Meeting recordings are often available if you can't attend live
- Start with Office Hours - they're more informal

## Community Values

The CALM community follows FINOS guidelines:
- **Open**: All discussions happen in the open
- **Inclusive**: Everyone's contribution is valued
- **Collaborative**: We build together
- **Respectful**: Treat others as you'd want to be treated

## Next Steps

Tomorrow (Day 22) you'll learn how to contribute to the CALM Copilot Chatmode by raising PRs!
