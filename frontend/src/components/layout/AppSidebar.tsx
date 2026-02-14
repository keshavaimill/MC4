import { useLocation } from "react-router-dom";
import {
  LayoutDashboard, TrendingUp, ChefHat, Wheat as WheatIcon,
  FlaskConical, Bell, FileText, Recycle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarRail, useSidebar,
} from "@/components/ui/sidebar";

const navGroups = [
  {
    label: "Overview",
    items: [
      { title: "Executive Overview", url: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Core Planning",
    items: [
      { title: "Demand & Forecast", url: "/demand", icon: TrendingUp },
      { title: "Production Planning", url: "/planning", icon: ChefHat },
      { title: "Raw Materials", url: "/materials", icon: WheatIcon },
    ],
  },
  {
    label: "AI COPILOT & SUSTAINABILITY VISION",
    items: [
      { title: "Waste & Vision 2030", url: "/waste", icon: Recycle },
      { title: "Alerts & Actions", url: "/alerts", icon: Bell },
      { title: "Reports & Emails", url: "/reports", icon: FileText },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="pt-4 bg-sidebar">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <NavLink
                          to={item.url}
                          className="gap-3 rounded-lg transition-colors hover:bg-accent/60"
                          activeClassName="bg-primary/10 text-primary font-semibold border-l-[3px] border-primary"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
