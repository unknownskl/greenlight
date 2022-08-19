import Button from "../../../renderer/components/ui/button";

export default {
  title: "Components/UI/Button",
  component: Button,
};

export const ButtonDefault = (args) => <Button {...args} />

export const ButtonPrimary = ButtonDefault.bind({});
ButtonPrimary.args = {
  className: 'btn-primary',
};

export const ButtonCancel = ButtonDefault.bind({});
ButtonCancel.args = {
  className: 'btn-cancel',
};

export const ButtonDisabled = ButtonDefault.bind({});
ButtonDisabled.args = {
  disabled: true,
  title: 'This button is disabled'
};

export const ButtonSmall = ButtonDefault.bind({});
ButtonSmall.args = {
  className: 'btn-small',
};

export const ButtonLarge = ButtonDefault.bind({});
ButtonLarge.args = {
  className: 'btn-large',
};

export const ButtonStartStreaming = ButtonDefault.bind({});
ButtonStartStreaming.args = {
  className: 'btn-large btn-primary',
  disabled: true,
  title: 'Xbox remote management is disabled. Please enable first before streaming',
  label: 'Start stream session'
};

// export const FooterNavigationConnected = FooterNavigation.bind({});
// FooterNavigationConnected.args = {
//   connected: true
// };