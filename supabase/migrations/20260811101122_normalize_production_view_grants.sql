revoke all on
  public_delegates,
  public_events,
  public_news,
  public_stats,
  transparency_regions,
  transparency_stats,
  admin_admins,
  admin_audit,
  admin_delegate_queue,
  admin_events,
  admin_finance_stats,
  admin_members,
  admin_news,
  admin_overview,
  admin_payments,
  admin_poll_options,
  admin_polls,
  admin_region_stats,
  admin_settings,
  admin_support_messages,
  member_event_going_counts,
  member_news,
  member_poll_options,
  member_polls,
  poll_option_counts
  from anon, authenticated;

grant select on
  public_delegates,
  public_events,
  public_news,
  public_stats,
  transparency_regions,
  transparency_stats
  to anon, authenticated;

grant select on
  admin_admins,
  admin_audit,
  admin_delegate_queue,
  admin_events,
  admin_finance_stats,
  admin_members,
  admin_news,
  admin_overview,
  admin_payments,
  admin_poll_options,
  admin_polls,
  admin_region_stats,
  admin_settings,
  admin_support_messages,
  member_event_going_counts,
  member_news,
  member_poll_options,
  member_polls,
  poll_option_counts
  to authenticated;
