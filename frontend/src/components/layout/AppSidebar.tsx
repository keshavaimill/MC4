import { useLocation } from "react-router-dom";
import {
  LayoutDashboard, TrendingUp, ChefHat, Factory, Wheat as WheatIcon,
  FlaskConical, Bell, FileText, Recycle, Star,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
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
      { title: "Recipe Planning", url: "/planning", icon: ChefHat, star: true },
      { title: "Mill Capacity", url: "/operations", icon: Factory, star: true },
    ],
  },
  {
    label: "Supply & Sustainability",
    items: [
      { title: "Raw Materials", url: "/materials", icon: WheatIcon },
      { title: "Waste & Vision 2030", url: "/waste", icon: Recycle },
    ],
  },
  {
    label: "Analysis",
    items: [
      { title: "Scenarios & What-If", url: "/scenarios", icon: FlaskConical },
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
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
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
                          className="gap-3"
                          activeClassName="bg-primary/10 text-primary font-semibold"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex items-center gap-1.5">
                            {item.title}
                            {item.star && (
                              <Star className="h-3 w-3 fill-primary text-primary" />
                            )}
                          </span>
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
    </Sidebar>
  );
}
